import Fastify from 'fastify'
import cors from '@fastify/cors'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { flowRoutes } from './routes.js'
import { FlowStore } from './store.js'
import { parseFlowYaml } from '@openhop/shared'

const app = Fastify({ logger: true })

await app.register(cors, { origin: true })

// Register Swagger
try {
  const swagger = await import('@fastify/swagger')
  const swaggerUi = await import('@fastify/swagger-ui')
  await app.register(swagger.default, {
    openapi: {
      info: {
        title: 'OpenHop API',
        description: 'Data flow visualization platform. AI tools POST flow definitions (YAML/JSON) and OpenHop renders them as animated diagrams.',
        version: '0.1.0',
      },
    },
  })
  await app.register(swaggerUi.default, { routePrefix: '/docs' })
} catch {
  // Swagger deps not available, skip
}

await app.register(flowRoutes)

// Seed example flow if store is empty
const store = new FlowStore()
const existing = await store.list()
if (existing.length === 0) {
  try {
    // Try to find examples directory
    const possiblePaths = [
      join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'examples', 'order-flow.yaml'),
      join(process.cwd(), 'examples', 'order-flow.yaml'),
    ]
    for (const p of possiblePaths) {
      try {
        const yaml = await readFile(p, 'utf-8')
        const result = parseFlowYaml(yaml)
        if (result.success && result.data) {
          await store.save('example-order-flow', result.data)
          console.log('Seeded example flow: example-order-flow')
          break
        }
      } catch { /* try next path */ }
    }
  } catch { /* no examples found, that's fine */ }
}

const port = parseInt(process.env.PORT ?? '8787')
await app.listen({ port, host: '0.0.0.0' })
console.log(`OpenHop server running on http://localhost:${port}`)
console.log(`Swagger docs at http://localhost:${port}/docs`)
