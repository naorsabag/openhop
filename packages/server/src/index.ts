import Fastify from 'fastify'
import cors from '@fastify/cors'
import { flowRoutes } from './routes.js'

const app = Fastify({ logger: true })

await app.register(cors, { origin: true })

// Register Swagger (try/catch in case deps not installed yet)
try {
  const swagger = await import('@fastify/swagger')
  const swaggerUi = await import('@fastify/swagger-ui')
  await app.register(swagger.default, {
    openapi: {
      info: { title: 'FlowScope API', version: '0.1.0' },
    },
  })
  await app.register(swaggerUi.default, { routePrefix: '/docs' })
} catch {
  // Swagger deps not available, skip
}

await app.register(flowRoutes)

const port = parseInt(process.env.PORT ?? '8787')
await app.listen({ port, host: '0.0.0.0' })
console.log(`FlowScope server running on http://localhost:${port}`)
console.log(`Swagger docs at http://localhost:${port}/docs`)
