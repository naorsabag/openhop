/**
 * Static web-UI server. Serves the prebuilt assets from `@openhop/web/dist/`
 * on port 8788 (the URL contract the CLI's `push` command points clients at).
 *
 * Resolved via createRequire so it works whether the CLI is installed
 * globally, locally, or invoked through `npx`. The web package ships only
 * `dist/` (per its `files:[dist]` whitelist) — its build-time deps are not
 * pulled in at install time.
 */

import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import Fastify, { type FastifyInstance } from 'fastify'
import fastifyStatic from '@fastify/static'

export interface StartWebOptions {
  /** TCP port. Default: 8788 (matches the URL the CLI's `push` returns). */
  port?: number
  /** Bind host. Default: 127.0.0.1. */
  host?: string
}

export interface RunningWeb {
  app: FastifyInstance
  url: string
  port: number
  host: string
  close(): Promise<void>
}

export async function startWebServer(opts: StartWebOptions = {}): Promise<RunningWeb> {
  const port = opts.port ?? 8788
  const host = opts.host ?? '127.0.0.1'

  const require = createRequire(import.meta.url)
  const webPkgPath = require.resolve('@openhop/web/package.json')
  const webDistRoot = join(dirname(webPkgPath), 'dist')

  const app = Fastify({ logger: false })
  await app.register(fastifyStatic, {
    root: webDistRoot,
    prefix: '/',
  })
  // SPA fallback — `/flow/<id>` and other client-routed paths return the
  // app shell so the web router can pick them up.
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
