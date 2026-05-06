/**
 * Static web-UI server. Serves the prebuilt assets from `@openhop/web/dist/`
 * on port 8788 (the URL contract the CLI's `push` command points clients at).
 *
 * Resolved via createRequire so it works whether the CLI is installed
 * globally, locally, or invoked through `npx`. The web package ships only
 * `dist/` (per its `files:[dist]` whitelist) — its build-time deps are not
 * pulled in at install time.
 *
 * The web bundle's data fetches (e.g. `/api/flows/<id>`) are RELATIVE URLs,
 * matching the dev-time setup where Vite proxies `/api` → `:8787`. In the
 * built / published bundle there's no Vite, so the web server must do the
 * proxying itself — otherwise the SPA's fetches hit this static server,
 * which has no /api routes and either 404s or (worse) lets the SPA fallback
 * return index.html as the response body. Hence @fastify/http-proxy below.
 */

import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import Fastify, { type FastifyInstance } from 'fastify'
import fastifyStatic from '@fastify/static'
import fastifyHttpProxy from '@fastify/http-proxy'

export interface StartWebOptions {
  /** TCP port. Default: 8788 (matches the URL the CLI's `push` returns). */
  port?: number
  /** Bind host. Default: 127.0.0.1. */
  host?: string
  /**
   * Origin of the API server (e.g. `http://127.0.0.1:8787`). Required for the
   * SPA's `/api/*` and `/health` requests to reach the API; without it the
   * SPA's data fetches fall through to the static + SPA fallback and return
   * HTML, which the SPA can't parse as JSON.
   */
  apiUrl: string
}

export interface RunningWeb {
  app: FastifyInstance
  url: string
  port: number
  host: string
  close(): Promise<void>
}

export async function startWebServer(opts: StartWebOptions): Promise<RunningWeb> {
  const port = opts.port ?? 8788
  const host = opts.host ?? '127.0.0.1'

  const require = createRequire(import.meta.url)
  const webPkgPath = require.resolve('@openhop/web/package.json')
  const webDistRoot = join(dirname(webPkgPath), 'dist')

  const app = Fastify({ logger: false })

  // /api/* and /health → proxy to the API server. Registered BEFORE the
  // static plugin so /api requests hit the proxy first, not the static
  // 404-handler-with-SPA-fallback that would mask the proxy.
  await app.register(fastifyHttpProxy, {
    upstream: opts.apiUrl,
    prefix: '/api',
    rewritePrefix: '/api',
  })
  await app.register(fastifyHttpProxy, {
    upstream: opts.apiUrl,
    prefix: '/health',
    rewritePrefix: '/health',
  })

  await app.register(fastifyStatic, {
    root: webDistRoot,
    prefix: '/',
  })
  // SPA fallback — `/flow/<id>` and other client-routed paths return the
  // app shell so the web router can pick them up. /api/* and /health are
  // already handled by the proxy above so they never reach this fallback.
  app.setNotFoundHandler((_req, reply) => {
    return reply.sendFile('index.html')
  })

  await app.listen({ port, host })
  const url = `http://${host}:${port}`
  return {
    app,
    url,
    port,
    host,
    close: () => app.close(),
  }
}
