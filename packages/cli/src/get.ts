import { Command } from 'commander'
import { errorMessage, bold, dim, red, emitJson, errStderr, logStderr } from './utils.js'
import { ExitCode } from './exit-codes.js'

/** Register `openhop get <id>` — fetch a single flow by id.
 *
 *  v0.1 JSON shape divergence from spec 16: spec example shows
 *  `{id, yaml, svg, metadata}`. We pass through the server's storedFlow
 *  shape (`{meta, flow, version, ...}`) instead. Reasons:
 *    - There is no server-side SVG renderer in v0.1; emitting `svg: null`
 *      every time would be misleading. (Re-add once #47 lands `render`.)
 *    - Re-serializing the flow back to YAML on the client is lossy
 *      (formatting, comments, anchor reuse). Users who need YAML can pipe
 *      the JSON through a YAML serializer.
 *  This is documented in CHANGELOG and in `help --json`'s examples. */
export function registerGet(program: Command, defaultServer: string): void {
  program
    .command('get <flow-id>')
    .description('Fetch a flow by id')
    .option('-s, --server <url>', 'Server URL', defaultServer)
    .option('--json', 'Emit JSON on stdout (machine-readable)')
    .action(async (flowId: string, opts) => {
      try {
        const res = await fetch(`${opts.server}/api/flows/${flowId}`)

        const fullUrl = `${opts.server}/api/flows/${flowId}`

        if (res.status === 404) {
          if (opts.json) emitJson({ ok: false, error: 'not-found', id: flowId })
          else errStderr(red(`✗ Flow "${flowId}" not found`))
          process.exit(ExitCode.NOT_FOUND)
        }

        if (!res.ok) {
          const body = await res.text()
          if (opts.json) emitJson({ ok: false, error: 'server', status: res.status, body })
          else errStderr(red(`✗ Server error (${res.status}): ${body}`))
          process.exit(ExitCode.NETWORK)
        }

        const flow = (await res.json()) as Record<string, unknown> & {
          flow?: { nodes?: unknown[] }
        }

        if (opts.json) {
          // Add a flat `nodeCount` so the JSON shape lines up with `push --json`.
          // Saves agents from having to reach into `.flow.nodes.length`.
          const nodeCount = Array.isArray(flow.flow?.nodes) ? flow.flow!.nodes!.length : 0
          emitJson({ ...flow, nodeCount })
          return
        }

        // Human mode: print a summary on stderr, the full JSON on stdout so
        // it pipes cleanly to a file.
        const meta = (flow as { meta?: { title?: unknown } }).meta
        const title = typeof meta?.title === 'string' ? meta.title : undefined
        logStderr(dim(`# Flow ${flowId}`))
        if (title) logStderr(`${bold('Title:')} ${title}`)
        if (typeof flow.version === 'number') logStderr(`${bold('Version:')} v${flow.version}`)
        process.stdout.write(JSON.stringify(flow, null, 2) + '\n')
      } catch (err) {
        const fullUrl = `${opts.server}/api/flows/${flowId}`
        if (opts.json) {
          emitJson({ ok: false, error: 'network', message: errorMessage(err), url: fullUrl })
        } else {
          errStderr(red(`✗ Connection failed (${fullUrl}): ${errorMessage(err)}`))
        }
        process.exit(ExitCode.NETWORK)
      }
    })
}
