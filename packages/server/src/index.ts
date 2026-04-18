import Fastify from 'fastify'
import cors from '@fastify/cors'
import { flowRoutes } from './routes.js'
import { FlowStore } from './store.js'
import { syncExampleOrderFlow } from './seed-example.js'

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

// Keep the built-in example flow synced with examples/order-flow.yaml.
const store = new FlowStore()
try {
  const syncResult = await syncExampleOrderFlow(store)
  if (syncResult === 'created') {
    console.log('Seeded example flow: example-order-flow')
  } else if (syncResult === 'updated') {
    console.log('Updated example flow: example-order-flow')
  }
} catch {
  // No example flow available, that's fine for local development.
}

const port = parseInt(process.env.PORT ?? '8787')
await app.listen({ port, host: '0.0.0.0' })
console.log(`OpenHop server running on http://localhost:${port}`)
console.log(`Swagger docs at http://localhost:${port}/docs`)
