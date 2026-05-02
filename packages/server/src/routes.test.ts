import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Fastify, { type FastifyInstance } from 'fastify'

let tmpHome: string
const originalHome = process.env.HOME

/** Build a Fastify instance with the same shared schemas + flowRoutes plugin
 *  as the production bootstrap, but without listening on a port. */
async function buildApp(): Promise<FastifyInstance> {
  const { sharedJsonSchemas } = await import('@openhop/shared')
  const { flowRoutes } = await import('./routes.js')
  const app = Fastify()
  for (const schema of sharedJsonSchemas) app.addSchema(schema)
  await app.register(flowRoutes)
  return app
}

describe('flow routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    tmpHome = await mkdtemp(join(tmpdir(), 'openhop-server-test-'))
    process.env.HOME = tmpHome
  })

  afterAll(async () => {
    process.env.HOME = originalHome
    if (tmpHome) await rm(tmpHome, { recursive: true, force: true })
    if (app) await app.close()
  })

  beforeEach(async () => {
    if (app) await app.close()
    app = await buildApp()
  })

  describe('GET /health', () => {
    it('returns ok status', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' })
      expect(res.statusCode).toBe(200)
      const body = res.json() as { status: string; version: string }
      expect(body.status).toBe('ok')
      expect(body.version).toBeDefined()
    })
  })

  describe('POST /api/flows', () => {
    const sampleYaml = `
meta:
  title: Test Flow
flow:
  nodes:
    - id: a
      label: A
    - id: b
      label: B
  steps:
    - from: a
      to: b
      data: hello
`

    it('creates a flow from YAML', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/flows',
        headers: { 'content-type': 'text/yaml' },
        payload: sampleYaml,
      })
      expect(res.statusCode).toBe(201)
      const body = res.json() as { id: string; title: string; version: number }
      expect(body.id).toBeDefined()
      expect(body.title).toBe('Test Flow')
      expect(body.version).toBe(1)
    })

    it('generated IDs are alphanumeric-only (no leading dash / underscore)', async () => {
      // Flow IDs are passed as positional CLI args (e.g. `openhop get <id>`).
      // Commander rejects tokens that start with `-` as unknown options, so a
      // leading-dash ID crashes the command line. Generate a batch and check
      // the alphabet to lock in the fix.
      const ids: string[] = []
      for (let i = 0; i < 100; i++) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/flows',
          headers: { 'content-type': 'text/yaml' },
          payload: sampleYaml,
        })
        expect(res.statusCode).toBe(201)
        ids.push((res.json() as { id: string }).id)
      }
      const alphanumeric = /^[0-9a-zA-Z]{12}$/
      for (const id of ids) {
        expect(id, `id "${id}" is not 12 alphanumeric chars`).toMatch(alphanumeric)
      }
    })

    it('creates a flow from JSON', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/flows',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          meta: { title: 'JSON Flow' },
          flow: { nodes: [{ id: 'a', label: 'A' }] },
        }),
      })
      expect(res.statusCode).toBe(201)
      expect((res.json() as { title: string }).title).toBe('JSON Flow')
    })

    it('rejects an invalid flow with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/flows',
        headers: { 'content-type': 'text/yaml' },
        payload: 'meta:\n  title: ""\nflow:\n  nodes: []\n',
      })
      expect(res.statusCode).toBe(400)
      const body = res.json() as { error: string; details: unknown[] }
      expect(body.error).toBe('validation_error')
      expect(body.details.length).toBeGreaterThan(0)
    })

    it('rejects malformed YAML with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/flows',
        headers: { 'content-type': 'text/yaml' },
        payload: '{{{{not yaml',
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('GET /api/flows', () => {
    it('returns an empty list when no flows exist', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/flows' })
      expect(res.statusCode).toBe(200)
      const body = res.json() as Array<unknown>
      expect(Array.isArray(body)).toBe(true)
    })

    it('lists created flows', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/flows',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          meta: { title: 'Listed' },
          flow: { nodes: [{ id: 'a', label: 'A' }] },
        }),
      })
      const res = await app.inject({ method: 'GET', url: '/api/flows' })
      expect(res.statusCode).toBe(200)
      const body = res.json() as Array<{ title: string }>
      expect(body.some((f) => f.title === 'Listed')).toBe(true)
    })
  })

  describe('GET /api/flows/search', () => {
    beforeEach(async () => {
      const seeds = [
        { meta: { title: 'Order Processing', path: 'e-commerce/orders' } },
        { meta: { title: 'Order Refunds', path: 'e-commerce/orders' } },
        { meta: { title: 'Auth Flow', path: 'platform/auth' } },
      ]
      for (const m of seeds) {
        await app.inject({
          method: 'POST',
          url: '/api/flows',
          headers: { 'content-type': 'application/json' },
          payload: JSON.stringify({
            ...m,
            flow: { nodes: [{ id: 'a', label: 'A' }] },
          }),
        })
      }
    })

    it('ranks exact-title matches first', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/flows/search?q=Auth%20Flow' })
      expect(res.statusCode).toBe(200)
      const body = res.json() as Array<{ flow: { title: string }; score: number }>
      expect(body[0].flow.title).toBe('Auth Flow')
      expect(body[0].score).toBe(1000)
    })

    it('finds substring matches in path', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/flows/search?q=platform' })
      const body = res.json() as Array<{ flow: { title: string }; matched: string }>
      expect(body[0].flow.title).toBe('Auth Flow')
      expect(body[0].matched).toBe('path')
    })

    it('honours the limit query param', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/flows/search?q=order&limit=1' })
      const body = res.json() as Array<unknown>
      expect(body.length).toBe(1)
    })
  })

  describe('GET /api/flows/tree', () => {
    it('groups flows by path segments under a single root', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/flows',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          meta: { title: 'Treed', path: 'a/b' },
          flow: { nodes: [{ id: 'n', label: 'N' }] },
        }),
      })
      const res = await app.inject({ method: 'GET', url: '/api/flows/tree' })
      expect(res.statusCode).toBe(200)
      const root = res.json() as {
        folders: Array<{ name: string; folders: Array<{ name: string }> }>
      }
      const a = root.folders.find((f) => f.name === 'a')
      expect(a).toBeTruthy()
      expect(a!.folders.find((f) => f.name === 'b')).toBeTruthy()
    })
  })

  describe('GET /api/flows/:id', () => {
    it('returns the full flow', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/flows',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          meta: { title: 'Read Me' },
          flow: { nodes: [{ id: 'a', label: 'A' }] },
        }),
      })
      const id = (created.json() as { id: string }).id
      const res = await app.inject({ method: 'GET', url: `/api/flows/${id}` })
      expect(res.statusCode).toBe(200)
      const body = res.json() as { id: string; meta: { title: string } }
      expect(body.id).toBe(id)
      expect(body.meta.title).toBe('Read Me')
    })

    it('404s on missing id', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/flows/does-not-exist' })
      expect(res.statusCode).toBe(404)
    })
  })

  describe('PATCH /api/flows/:id', () => {
    async function createFlow(): Promise<string> {
      const res = await app.inject({
        method: 'POST',
        url: '/api/flows',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          meta: { title: 'Patchable' },
          flow: {
            nodes: [
              { id: 'a', label: 'A' },
              { id: 'b', label: 'B' },
            ],
            steps: [{ from: 'a', to: 'b', data: 'hi' }],
          },
        }),
      })
      return (res.json() as { id: string }).id
    }

    it('applies a rename-nodes patch and bumps version', async () => {
      const id = await createFlow()
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/flows/${id}`,
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          operations: [{ op: 'rename-nodes', nodes: [{ id: 'a', label: 'Alpha' }] }],
        }),
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as { version: number }
      expect(body.version).toBe(2)

      const get = await app.inject({ method: 'GET', url: `/api/flows/${id}` })
      const flow = get.json() as { flow: { nodes: Array<{ label: string }> } }
      expect(flow.flow.nodes[0].label).toBe('Alpha')
    })

    it('returns 400 for invalid patch operations', async () => {
      const id = await createFlow()
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/flows/${id}`,
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          operations: [{ op: 'rename-nodes', nodes: [{ id: 'missing', label: 'X' }] }],
        }),
      })
      expect(res.statusCode).toBe(400)
    })

    it('returns 404 patching an unknown id', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/flows/missing',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          operations: [{ op: 'rename-nodes', nodes: [{ id: 'a', label: 'X' }] }],
        }),
      })
      expect(res.statusCode).toBe(404)
    })
  })

  describe('DELETE /api/flows/:id', () => {
    it('removes a flow and 404s on a second delete', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/flows',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          meta: { title: 'Goner' },
          flow: { nodes: [{ id: 'a', label: 'A' }] },
        }),
      })
      const id = (created.json() as { id: string }).id

      const first = await app.inject({ method: 'DELETE', url: `/api/flows/${id}` })
      expect(first.statusCode).toBe(204)

      const second = await app.inject({ method: 'DELETE', url: `/api/flows/${id}` })
      expect(second.statusCode).toBe(404)
    })
  })
})
