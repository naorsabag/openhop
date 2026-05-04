/**
 * `openhop demo` — one-command bootstrap for first-time users.
 *
 * Boots the API + web UI in-process, posts a starter flow, opens the user's
 * browser at the rendered URL, and stays running until SIGINT.
 *
 * Substitute for the hosted-playground "Try it live" link (the playground
 * is deferred to post-launch per openhop-launch/02-hosted-playground.md:3).
 * Closes the abort criterion in 01-repo-readiness.md:37.
 */

import { spawn } from 'node:child_process'
import type { Command } from 'commander'
import { errorMessage, errStderr, logStderr, dim, red, green, cyan, bold } from './utils.js'
import { ExitCode } from './exit-codes.js'

/**
 * The bundled starter flow. Inlined here (rather than read from disk at
 * runtime) so the CLI tarball doesn't need to ship `examples/`. esbuild
 * keeps this as a single string literal in dist/index.js — ~2 KB.
 */
const STARTER_FLOW_YAML = `meta:
  title: Authentication Flow
  path: examples/auth
  description: OAuth2 login with JWT tokens

flow:
  nodes:
    - id: browser
      label: Browser
      type: actor
    - id: app
      label: App Server
      type: endpoint
    - id: oauth
      label: Google OAuth
      type: external
      icon: "logos:google-icon"
    - id: db
      label: User DB
      type: database
    - id: cache
      label: Session Cache
      type: cache

  steps:
    - from: browser
      to: app
      data: GET /login
    - from: app
      to: oauth
      data: Redirect to Google
    - from: oauth
      to: app
      data:
        label: OAuth callback
        fields:
          - name: code
            type: string
          - name: state
            type: string
    - from: app
      to: oauth
      data: Exchange code for token
    - from: oauth
      to: app
      data:
        label: Token response
        fields:
          - name: access_token
          - name: id_token
          - name: email
            added: true
    - from: app
      to: [db, cache]
      data: Store user + session
    - parallel:
        - from: db
          to: app
          data: user_id
        - from: cache
          to: app
          data: session_id
    - from: app
      to: browser
      data:
        label: Set cookie + redirect
        fields:
          - name: session_id
          - name: redirect_to
            type: string
`

/** Cross-platform browser launcher. Avoids adding a runtime dependency. */
function openInBrowser(url: string): void {
  const platform = process.platform
  const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open'
  const child = spawn(cmd, [url], {
    detached: true,
    stdio: 'ignore',
    shell: platform === 'win32',
  })
  child.on('error', () => {
    // Browser couldn't be opened (headless box, no $DISPLAY, etc.) — the URL
    // still gets printed below, so the user can copy-paste.
  })
  child.unref()
}

export function registerDemo(program: Command): void {
  program
    .command('demo')
    .description('One-shot bootstrap: start API + web UI, push a starter flow, open the browser')
    .option('-p, --port <port>', 'API port', '8787')
    .option('--web-port <port>', 'Web UI port', '8788')
    .option('--no-open', "Don't open the browser (print the URL only)")
    .action(async (opts) => {
      const apiPort = Number.parseInt(opts.port, 10)
      const webPort = Number.parseInt(opts.webPort, 10)

      logStderr(dim(`Starting OpenHop API on port ${apiPort}...`))
      const { startServer } = await import('@openhop/server')
      let api: { url: string; close: () => Promise<void> }
      try {
        api = await startServer({ port: apiPort, logger: false })
      } catch (err) {
        errStderr(red(`✗ Failed to start API: ${errorMessage(err)}`))
        process.exit(ExitCode.GENERIC)
      }

      logStderr(dim(`Starting OpenHop web UI on port ${webPort}...`))
      let web: { url: string; close: () => Promise<void> }
      try {
        const { startWebServer } = await import('./web-server.js')
        web = await startWebServer({ port: webPort })
      } catch (err) {
        errStderr(red(`✗ Failed to start web UI: ${errorMessage(err)}`))
        await api.close()
        process.exit(ExitCode.GENERIC)
      }

      // Push the starter flow.
      logStderr(dim('Pushing starter flow...'))
      const pushUrl = `${api.url}/api/flows`
      let flowId: string
      try {
        const res = await fetch(pushUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/yaml' },
          body: STARTER_FLOW_YAML,
        })
        if (!res.ok) {
          const body = await res.text()
          errStderr(red(`✗ Server rejected starter flow (${res.status}): ${body}`))
          await api.close()
          await web.close()
          process.exit(ExitCode.GENERIC)
        }
        const data = (await res.json()) as { id: string }
        flowId = data.id
      } catch (err) {
        errStderr(red(`✗ Failed to push starter flow: ${errorMessage(err)}`))
        await api.close()
        await web.close()
        process.exit(ExitCode.NETWORK)
      }

      const flowUrl = `${web.url}/flow/${flowId}`
      logStderr(green('✓ OpenHop demo ready'))
      logStderr(`  ${bold('API:')}  ${api.url}`)
      logStderr(`  ${bold('Web:')}  ${web.url}`)
      logStderr(`  ${bold('Flow:')} ${cyan(flowUrl)}`)
      logStderr(dim('  Press Ctrl-C to stop.'))

      if (opts.open !== false) {
        openInBrowser(flowUrl)
      }

      // Keep the process alive until SIGINT/SIGTERM.
      const shutdown = async (): Promise<never> => {
        logStderr(dim('Shutting down...'))
        try {
          await api.close()
        } catch {
          /* ignore */
        }
        try {
          await web.close()
        } catch {
          /* ignore */
        }
        process.exit(ExitCode.SUCCESS)
      }
      process.on('SIGINT', () => void shutdown())
      process.on('SIGTERM', () => void shutdown())

      // Stable, machine-parseable ready line on stdout (same shape as serve).
      process.stdout.write(`openhop: ready api=${api.url} web=${web.url} flow=${flowUrl}\n`)
    })
}
