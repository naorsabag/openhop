import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { nanoid } from 'nanoid'
import { parseFlowYaml, parseFlowJson, validateFlow } from '@flowscope/shared'
import { FlowStore } from './store.js'

const store = new FlowStore()

export async function flowRoutes(app: FastifyInstance): Promise<void> {
  // Register content type parsers for YAML (must be before routes)
  app.addContentTypeParser(
    ['text/yaml', 'application/x-yaml', 'text/x-yaml'],
    { parseAs: 'string' },
    (_req: FastifyRequest, body: string, done: (err: Error | null, result?: unknown) => void) => {
      done(null, body)
    }
  )

  // Register plain text parser as fallback
  app.addContentTypeParser(
    'text/plain',
    { parseAs: 'string' },
    (_req: FastifyRequest, body: string, done: (err: Error | null, result?: unknown) => void) => {
      done(null, body)
    }
  )

  // ── POST /api/flows — Create a new flow ────────────────────────────
  app.post('/api/flows', async (req: FastifyRequest, reply: FastifyReply) => {
    const contentType = req.headers['content-type'] ?? ''
    let validationResult

    if (
      contentType.includes('text/yaml') ||
      contentType.includes('application/x-yaml') ||
      contentType.includes('text/x-yaml')
    ) {
      // Explicit YAML content type
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
      validationResult = parseFlowYaml(body)
    } else if (contentType.includes('application/json')) {
      // Explicit JSON content type
      if (typeof req.body === 'string') {
        validationResult = parseFlowJson(req.body)
      } else {
        validationResult = validateFlow(req.body)
      }
    } else {
      // Auto-detect: try to guess from body content
      if (typeof req.body === 'string') {
        const trimmed = req.body.trimStart()
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          validationResult = parseFlowJson(req.body)
        } else {
          validationResult = parseFlowYaml(req.body)
        }
      } else if (typeof req.body === 'object' && req.body !== null) {
        validationResult = validateFlow(req.body)
      } else {
        return reply.status(400).send({
          error: 'invalid_body',
          details: [{ path: '', message: 'Request body is required' }],
        })
      }
    }

    if (!validationResult.success) {
      return reply.status(400).send({
        error: 'validation_error',
        details: validationResult.errors,
      })
    }

    const id = nanoid(12)
    const stored = await store.save(id, validationResult.data!)

    return reply.status(201).send({
      id: stored.id,
      version: stored.version,
      title: stored.flow.meta.title,
    })
  })

  // ── GET /api/flows — List all flows (summary) ─────────────────────
  app.get('/api/flows', async (_req: FastifyRequest, reply: FastifyReply) => {
    const flows = await store.list()
    const summaries = flows.map((f) => ({
      id: f.id,
      title: f.flow.meta.title,
      description: f.flow.meta.description ?? null,
      tags: f.flow.meta.tags ?? [],
      version: f.version,
      updatedAt: f.updatedAt,
    }))
    return reply.send(summaries)
  })

  // ── GET /api/flows/:id — Get full flow ─────────────────────────────
  app.get('/api/flows/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = req.params
    const stored = await store.get(id)
    if (!stored) {
      return reply.status(404).send({
        error: 'not_found',
        details: [{ path: '', message: `Flow "${id}" not found` }],
      })
    }
    return reply.send(stored)
  })

  // ── GET /api/flows/:id/version — Get version number only ──────────
  app.get('/api/flows/:id/version', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = req.params
    const version = await store.getVersion(id)
    if (version === null) {
      return reply.status(404).send({
        error: 'not_found',
        details: [{ path: '', message: `Flow "${id}" not found` }],
      })
    }
    return reply.send({ version })
  })

  // ── DELETE /api/flows/:id — Delete a flow ──────────────────────────
  app.delete('/api/flows/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = req.params
    const deleted = await store.delete(id)
    if (!deleted) {
      return reply.status(404).send({
        error: 'not_found',
        details: [{ path: '', message: `Flow "${id}" not found` }],
      })
    }
    return reply.status(204).send()
  })

}
