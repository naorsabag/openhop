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
program
  .command('serve')
  .description('Start the OpenHop server')
  .option('-p, --port <port>', 'Port to listen on', '8787')
  .action((opts) => {
    const serverEntry = resolve(import.meta.dirname, '../../server/src/index.ts')
    logStderr(dim(`Starting OpenHop server on port ${opts.port}...`))
    const child = spawn('npx', ['tsx', serverEntry], {
      stdio: 'inherit',
      env: { ...process.env, PORT: opts.port },
    })
    child.on('error', (err) => {
      errStderr(red(`Failed to start server: ${errorMessage(err)}`))
      process.exit(ExitCode.GENERIC)
    })
    child.on('exit', (code) => {
      process.exit(code ?? ExitCode.SUCCESS)
    })
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

    try {
      const res = await fetch(`${opts.server}/api/flows`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/yaml' },
        body: yamlContent,
      })

      if (!res.ok) {
        const body = await res.text()
        if (opts.json) {
          emitJson({ ok: false, error: 'server', status: res.status, body })
        } else {
          errStderr(red(`✗ Server error (${res.status}): ${body}`))
        }
        process.exit(mapServerStatus(res.status))
      }

      const data = (await res.json()) as { id: string; title: string; version: number }
      const webUrl = opts.server.replace(/:\d+$/, ':8788')
      const url = `${webUrl}/flow/${data.id}`
      // Spec asks for nodeCount in the JSON output. We have it locally from
      // the validated flow, no need to round-trip through the server.
      const nodeCount = result.data?.flow?.nodes?.length ?? 0

      if (opts.json) {
        emitJson({ id: data.id, title: data.title, version: data.version, url, nodeCount })
      } else {
        logStderr(green('✓ Flow created'))
        logStderr(`  ${bold('ID:')}    ${data.id}`)
        logStderr(`  ${bold('Title:')} ${data.title}`)
        logStderr(`  ${bold('URL:')}   ${cyan(url)}`)
      }
    } catch (err) {
      if (opts.json) {
        emitJson({ ok: false, error: 'network', message: errorMessage(err) })
      } else {
        errStderr(red(`✗ Connection failed: ${errorMessage(err)}`))
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
    try {
      const res = await fetch(`${opts.server}/api/flows`)
      if (!res.ok) {
        if (opts.json) emitJson({ ok: false, error: 'server', status: res.status })
        else errStderr(red(`✗ Server error (${res.status})`))
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
      if (opts.json) emitJson({ ok: false, error: 'network', message: errorMessage(err) })
      else errStderr(red(`✗ Connection failed: ${errorMessage(err)}`))
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

    try {
      const res = await fetch(`${opts.server}/api/flows/${flowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(operations),
      })

      if (!res.ok) {
        const body = await res.text()
        if (opts.json) {
          emitJson({ ok: false, error: 'server', status: res.status, body })
        } else {
          errStderr(red(`✗ Server error (${res.status}): ${body}`))
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
      if (opts.json) emitJson({ ok: false, error: 'network', message: errorMessage(err) })
      else errStderr(red(`✗ Connection failed: ${errorMessage(err)}`))
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
    try {
      const res = await fetch(`${opts.server}/api/flows/${flowId}`, { method: 'DELETE' })

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
        if (opts.json) emitJson({ ok: false, error: 'server', status: res.status, body })
        else errStderr(red(`✗ Server error (${res.status}): ${body}`))
        process.exit(ExitCode.NETWORK)
      }
    } catch (err) {
      if (opts.json) emitJson({ ok: false, error: 'network', message: errorMessage(err) })
      else errStderr(red(`✗ Connection failed: ${errorMessage(err)}`))
      process.exit(ExitCode.NETWORK)
    }
  })

// --- new commands wired from sibling modules ---
registerGet(program, DEFAULT_SERVER)
registerValidate(program)
registerInit(program)
registerHelpJson(program, API_VERSION)

program.parse()
