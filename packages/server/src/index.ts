import { fileURLToPath } from 'node:url'
import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import { sharedJsonSchemas } from '@openhop/shared'
import { flowRoutes } from './routes.js'
import { FlowStore } from './store.js'
import { seedBundledExamples } from './seed-examples.js'

/** Allow loopback browser origins (Swagger, local tooling). Block arbitrary web origins. */
function isAllowedCorsOrigin(
  origin: string | undefined,
  cb: (err: Error | null, allow: boolean | string) => void
): void {
  if (!origin) {
    cb(null, true)
    return
  }
  try {
    const { hostname } = new URL(origin)
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      cb(null, origin)
      return
    }
  } catch {
    // reject below
  }
  cb(null, false)
}

export interface StartServerOptions {
  /** TCP port. Default: process.env.PORT ?? 8787 */
  port?: number
  /** Bind host. Default: 127.0.0.1 (HOST env var overrides). */
  host?: string
  /** Pass through to Fastify. Default: true */
  logger?: boolean
}

export interface RunningServer {
  app: FastifyInstance
  url: string
  port: number
  host: string
  close(): Promise<void>
}

/** Build a Fastify app with OpenHop's routes registered. Does not call listen. */
export async function buildApp(opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? true })

  // Register shared schemas once so routes can reference them by $id.
  // (Required because `flowJsonSchema` is recursive — inlining it re-binds
  // its internal `$ref: "#"` to whatever parent schema is compiling.)
  for (const schema of sharedJsonSchemas) {
    app.addSchema(schema)
  }

  await app.register(cors, { origin: isAllowedCorsOrigin })

  try {
    const swagger = await import('@fastify/swagger')
    const swaggerUi = await import('@fastify/swagger-ui')
    await app.register(swagger.default, {
      openapi: {
        info: {
          title: 'OpenHop API',
          description:
            'Data flow visualization platform. AI tools POST flow definitions (YAML/JSON) and OpenHop renders them as animated diagrams.',
          version: '0.1.0-beta.1',
        },
      },
    })
    await app.register(swaggerUi.default, { routePrefix: '/docs' })
  } catch {
    // Swagger deps not available, skip.
  }

  await app.register(flowRoutes)

  // Seed the bundled example flows into the disk-backed store, if any
  // ship with this build. FlowStore is disk-backed (~/.openhop/flows by
  // default), so the seed writes become visible to the routes' own
  // FlowStore instance via the shared dir.
  const store = new FlowStore()
  try {
    const seed = await seedBundledExamples(store)
    if (seed.created.length > 0) {
      app.log.info({ created: seed.created }, `Seeded ${seed.created.length} example flow(s)`)
    }
    if (seed.updated.length > 0) {
      app.log.info({ updated: seed.updated }, `Updated ${seed.updated.length} example flow(s)`)
    }
    if (seed.failed.length > 0) {
      app.log.warn({ failed: seed.failed }, `${seed.failed.length} example(s) failed to parse`)
    }
  } catch {
    // No bundled examples available — that's fine in stripped-down builds.
  }

  return app
}

/** Build the app and start listening. Returns a handle for in-process callers. */
export async function startServer(opts: StartServerOptions = {}): Promise<RunningServer> {
  const port = opts.port ?? Number.parseInt(process.env.PORT ?? '8787', 10)
  // Default to loopback so a casual `npm run dev` is not exposed to the LAN.
  // Containers / docker-compose set HOST=0.0.0.0 to bind every interface.
  const host = opts.host ?? process.env.HOST ?? '127.0.0.1'
  const app = await buildApp({ logger: opts.logger })
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

// Run as a script when this file is the program entry point. Works both for
// `node dist/server.js` (published) and `npx tsx src/index.ts` (dev). When
// imported as a library (CLI's `serve` and `demo` commands), the consumer
// calls startServer() themselves and this branch is skipped.
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  const running = await startServer()
  console.log(`OpenHop server running on ${running.url} (bound to ${running.host})`)
  console.log(`Swagger docs at ${running.url}/docs`)
}
