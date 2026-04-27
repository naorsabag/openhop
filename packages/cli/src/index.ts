import { Command } from 'commander'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import YAML from 'yaml'
import { parseFlowYaml } from '@openhop/shared'
import {
  readInput,
  errorMessage,
  padRight,
  green,
  red,
  bold,
  dim,
  cyan,
  emitJson,
  errStderr,
  logStderr,
} from './utils.js'
import { ExitCode } from './exit-codes.js'
import { registerGet } from './get.js'
import { registerValidate } from './validate.js'
import { registerHelpJson } from './help-json.js'
import { registerInit } from './init.js'

const DEFAULT_SERVER = 'http://localhost:8787'

/** Bump when the CLI's machine contract changes in a breaking way.
 *  Agents branch behavior on this, not on --version. */
const API_VERSION = 1

/** Map an HTTP response status to a semantic exit code.
 *  - 400 → VALIDATION (server rejected the request body)
 *  - 404 → NOT_FOUND
 *  - 409 → CONFLICT
 *  - everything else → NETWORK
 *  Matches the contract in 16-cli-as-universal-api.md. */
function mapServerStatus(status: number): number {
  if (status === 400) return ExitCode.VALIDATION
  if (status === 404) return ExitCode.NOT_FOUND
  if (status === 409) return ExitCode.CONFLICT
  return ExitCode.NETWORK
}

// Top-level --api-version is handled before Commander parses, so it works
// with or without a subcommand and never interacts with subcommand options.
if (process.argv.includes('--api-version')) {
  process.stdout.write(String(API_VERSION) + '\n')
  process.exit(ExitCode.SUCCESS)
}

const program = new Command()

program.name('openhop').description('OpenHop — Data Flow Visualization CLI').version('0.1.0')

// --- serve ---
//
// Starts both the API server (Fastify on :8787) and the web UI dev server
// (Vite on :8788). The URL printed by `push` points at the web UI port, so
// without the web running the user lands on a 404 — that's what a fresh
// agent's cold-start test surfaced. Use --no-web to opt out (CI, headless).
//
// Note: this command only works inside a from-source checkout of the
// monorepo, because the server and web entries are looked up relative to
// the CLI bundle's dirname. The published `npm i -g openhop` package
// doesn't ship the server/web sources — for production deployments use
// docker-compose or clone the repo. Tracked for v0.2 with a separate
// `@openhop/server` package.
program
  .command('serve')
  .description('Start the OpenHop API server (:8787) and web UI (:8788)')
  .option('-p, --port <port>', 'API port', '8787')
  .option('--no-web', 'Start API only, skip the web UI dev server')
  .option('--no-wait-ready', "Don't probe /health and don't print the ready line on stdout")
  .option('--ready-timeout <seconds>', 'How long to wait for readiness before giving up', '60')
  .action(async (opts) => {
    const cliDir = resolve(import.meta.dirname, '..', '..')
    const serverEntry = resolve(cliDir, 'server', 'src', 'index.ts')
    const webDir = resolve(cliDir, 'web')

    logStderr(dim(`Starting OpenHop API on port ${opts.port}...`))
    // Pipe child stdout/stderr to OUR stderr — the CLI contract says stdout
    // is for data only. Without this, Fastify's pino logs and Vite's dev
    // banner would pollute parent stdout and break agents that pipe
    // `serve` output through jq.
    const api = spawn('npx', ['tsx', serverEntry], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: opts.port },
    })
    api.stdout?.pipe(process.stderr)
    api.stderr?.pipe(process.stderr)

    let web: ReturnType<typeof spawn> | null = null
    if (opts.web !== false) {
      logStderr(dim('Starting OpenHop web UI on port 8788...'))
      web = spawn('npm', ['run', 'dev'], {
        cwd: webDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
      })
      web.stdout?.pipe(process.stderr)
      web.stderr?.pipe(process.stderr)
      web.on('error', (err) => {
        errStderr(red(`Failed to start web UI: ${errorMessage(err)}`))
        // Web failure is non-fatal — API can still run for headless agents.
      })
    }

    const shutdown = () => {
      api.kill('SIGTERM')
      web?.kill('SIGTERM')
    }
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)

    api.on('error', (err) => {
      errStderr(red(`Failed to start API: ${errorMessage(err)}`))
      web?.kill('SIGTERM')
      process.exit(ExitCode.GENERIC)
    })
    api.on('exit', (code) => {
      web?.kill('SIGTERM')
      process.exit(code ?? ExitCode.SUCCESS)
    })

    // Readiness probe. Default-on: poll /health until it returns 200, then
    // emit a stable, machine-parseable line on stdout. This is the only
    // thing `serve` puts on stdout, so callers can do:
    //   openhop serve & wait_for=$(grep -m1 '^openhop: ready ' fd 1)
    // Without --no-wait-ready, downstream scripts have to poll /health
    // themselves to know when they can push.
    if (opts.waitReady !== false) {
      const timeoutSec = Number.parseInt(opts.readyTimeout, 10) || 60
      const apiUrl = `http://localhost:${opts.port}`
      const webPart = opts.web !== false ? ` web=http://localhost:8788` : ''
      const t0 = Date.now()
      const deadline = t0 + timeoutSec * 1000
      while (Date.now() < deadline) {
        try {
          const r = await fetch(`${apiUrl}/health`)
          if (r.ok) {
            const elapsed = Math.round((Date.now() - t0) / 100) / 10
            process.stdout.write(`openhop: ready api=${apiUrl}${webPart} elapsed=${elapsed}s\n`)
            break
          }
        } catch {
          // Not ready yet — back off and retry.
        }
        await new Promise((r) => setTimeout(r, 500))
      }
      if (Date.now() >= deadline) {
        errStderr(red(`✗ API did not become ready within ${timeoutSec}s. Check logs above.`))
        // Don't exit — the children may still come up. Just warn.
      }
    }
  })

// --- push ---
program
  .command('push <file>')
  .description('Push a YAML flow to the server (use - for stdin)')
  .option('-s, --server <url>', 'Server URL', DEFAULT_SERVER)
  .option('--json', 'Emit JSON on stdout (machine-readable)')
  .action(async (file: string, opts) => {
    const yamlContent = readInput(file)

    // Validate locally first
    const result = parseFlowYaml(yamlContent)
    if (!result.success) {
      if (opts.json) {
        emitJson({
          ok: false,
          error: 'validation',
          errors: result.errors.map((e) => ({
            path: e.path,
            message: e.message,
            suggestion: e.suggestion,
          })),
        })
      } else {
        errStderr(red('✗ Validation errors:'))
        for (const err of result.errors) {
          const suggestion = err.suggestion ? ` ${err.suggestion}` : ''
          errStderr(`  ${dim(err.path + ':')} ${err.message}${suggestion}`)
        }
      }
      process.exit(ExitCode.VALIDATION)
    }

    const url = `${opts.server}/api/flows`
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/yaml' },
        body: yamlContent,
      })

      if (!res.ok) {
        const body = await res.text()
        if (opts.json) {
          emitJson({ ok: false, error: 'server', status: res.status, body, url })
        } else {
          errStderr(red(`✗ Server error (${res.status}) at ${url}: ${body}`))
        }
        process.exit(mapServerStatus(res.status))
      }

      const data = (await res.json()) as { id: string; title: string; version: number }
      const webUrl = opts.server.replace(/:\d+$/, ':8788')
      const flowUrl = `${webUrl}/flow/${data.id}`
      // Spec asks for nodeCount in the JSON output. We have it locally from
      // the validated flow, no need to round-trip through the server.
      const nodeCount = result.data?.flow?.nodes?.length ?? 0

      if (opts.json) {
        emitJson({
          id: data.id,
          title: data.title,
          version: data.version,
          url: flowUrl,
          nodeCount,
        })
      } else {
        logStderr(green('✓ Flow created'))
        logStderr(`  ${bold('ID:')}    ${data.id}`)
        logStderr(`  ${bold('Title:')} ${data.title}`)
        logStderr(`  ${bold('URL:')}   ${cyan(flowUrl)}`)
      }
    } catch (err) {
      if (opts.json) {
        emitJson({ ok: false, error: 'network', message: errorMessage(err), url })
      } else {
        errStderr(red(`✗ Connection failed (${url}): ${errorMessage(err)}`))
      }
      process.exit(ExitCode.NETWORK)
    }
  })

// --- list ---
program
  .command('list')
  .description('List all flows on the server')
  .option('-s, --server <url>', 'Server URL', DEFAULT_SERVER)
  .option('--json', 'Emit JSON on stdout (machine-readable)')
  .action(async (opts) => {
    const url = `${opts.server}/api/flows`
    try {
      const res = await fetch(url)
      if (!res.ok) {
        if (opts.json) emitJson({ ok: false, error: 'server', status: res.status, url })
        else errStderr(red(`✗ Server error (${res.status}) at ${url}`))
        process.exit(ExitCode.NETWORK)
      }

      const flows = (await res.json()) as Array<{
        id: string
        title: string
        path?: string
        version: number
        updatedAt: string
      }>

      if (opts.json) {
        emitJson({ flows })
        return
      }

      if (flows.length === 0) {
        logStderr(dim('No flows found.'))
        return
      }

      const cols = [
        { key: 'id', label: 'ID', width: 16 },
        { key: 'title', label: 'Title', width: 16 },
        { key: 'path', label: 'Path', width: 22 },
        { key: 'version', label: 'Version', width: 9 },
        { key: 'updatedAt', label: 'Updated', width: 12 },
      ] as const

      // Tabular output goes to stdout (data), no ANSI when piped.
      const header = cols.map((c) => bold(padRight(c.label, c.width))).join('')
      process.stdout.write(header + '\n')

      for (const flow of flows) {
        const date = flow.updatedAt ? new Date(flow.updatedAt).toISOString().slice(0, 10) : ''
        const row = [
          padRight(flow.id, 16),
          padRight(flow.title || '', 16),
          padRight(flow.path || '', 22),
          padRight(`v${flow.version}`, 9),
          padRight(date, 12),
        ].join('')
        process.stdout.write(row + '\n')
      }
    } catch (err) {
      if (opts.json) {
        emitJson({ ok: false, error: 'network', message: errorMessage(err), url })
      } else {
        errStderr(red(`✗ Connection failed (${url}): ${errorMessage(err)}`))
      }
      process.exit(ExitCode.NETWORK)
    }
  })

// --- patch ---
program
  .command('patch <flow-id> <file>')
  .description('Patch a flow with operations from a YAML file (use - for stdin)')
  .option('-s, --server <url>', 'Server URL', DEFAULT_SERVER)
  .option('--json', 'Emit JSON on stdout (machine-readable)')
  .action(async (flowId: string, file: string, opts) => {
    const content = readInput(file)

    let operations: unknown
    try {
      operations = YAML.parse(content)
    } catch (err) {
      if (opts.json) emitJson({ ok: false, error: 'parse', message: errorMessage(err) })
      else errStderr(red(`✗ Parse error: ${errorMessage(err)}`))
      process.exit(ExitCode.VALIDATION)
    }

    const { patchSchema } = await import('@openhop/shared')
    const validation = patchSchema.safeParse(operations)
    if (!validation.success) {
      if (opts.json) {
        emitJson({
          ok: false,
          error: 'validation',
          errors: validation.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        })
      } else {
        errStderr(red('✗ Validation errors:'))
        for (const issue of validation.error.issues) {
          errStderr(`  ${dim(issue.path.join('.') + ':')} ${issue.message}`)
        }
      }
      process.exit(ExitCode.VALIDATION)
    }

    const url = `${opts.server}/api/flows/${flowId}`
    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(operations),
      })

      if (!res.ok) {
        const body = await res.text()
        if (opts.json) {
          emitJson({ ok: false, error: 'server', status: res.status, body, url })
        } else {
          errStderr(red(`✗ Server error (${res.status}) at ${url}: ${body}`))
        }
        process.exit(mapServerStatus(res.status))
      }

      const data = (await res.json()) as { id: string; title: string; version: number }
      if (opts.json) {
        emitJson({ id: data.id, title: data.title, version: data.version })
      } else {
        logStderr(green('✓ Flow patched'))
        logStderr(`  ${bold('ID:')}      ${data.id}`)
        logStderr(`  ${bold('Title:')}   ${data.title}`)
        logStderr(`  ${bold('Version:')} v${data.version}`)
      }
    } catch (err) {
      if (opts.json) {
        emitJson({ ok: false, error: 'network', message: errorMessage(err), url })
      } else {
        errStderr(red(`✗ Connection failed (${url}): ${errorMessage(err)}`))
      }
      process.exit(ExitCode.NETWORK)
    }
  })

// --- remove ---
program
  .command('remove <flow-id>')
  .description('Delete a flow from the server')
  .option('-s, --server <url>', 'Server URL', DEFAULT_SERVER)
  .option('--json', 'Emit JSON on stdout (machine-readable)')
  .action(async (flowId: string, opts) => {
    const url = `${opts.server}/api/flows/${flowId}`
    try {
      const res = await fetch(url, { method: 'DELETE' })

      if (res.status === 204) {
        if (opts.json) emitJson({ id: flowId, deleted: true })
        else {
          logStderr(green('✓ Flow deleted'))
          logStderr(`  ${bold('ID:')} ${flowId}`)
        }
      } else if (res.status === 404) {
        if (opts.json) emitJson({ ok: false, error: 'not-found', id: flowId })
        else errStderr(red(`✗ Flow "${flowId}" not found`))
        process.exit(ExitCode.NOT_FOUND)
      } else {
        const body = await res.text()
        if (opts.json) emitJson({ ok: false, error: 'server', status: res.status, body, url })
        else errStderr(red(`✗ Server error (${res.status}) at ${url}: ${body}`))
        process.exit(ExitCode.NETWORK)
      }
    } catch (err) {
      if (opts.json) {
        emitJson({ ok: false, error: 'network', message: errorMessage(err), url })
      } else {
        errStderr(red(`✗ Connection failed (${url}): ${errorMessage(err)}`))
      }
      process.exit(ExitCode.NETWORK)
    }
  })

// --- new commands wired from sibling modules ---
registerGet(program, DEFAULT_SERVER)
registerValidate(program)
registerInit(program)
registerHelpJson(program, API_VERSION)

program.parse()
