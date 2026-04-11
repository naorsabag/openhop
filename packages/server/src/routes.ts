import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { nanoid } from 'nanoid'
import { parseFlowYaml, parseFlowJson, validateFlow } from '@flowscope/shared'
import { FlowStore } from './store.js'

const store = new FlowStore()

const EXAMPLE_YAML = `meta:
  title: Simple Flow
  description: A minimal example
  tags: [example]

flow:
  nodes:
    - id: user
      label: User
      type: actor
    - id: api
      label: API
      type: endpoint
  steps:
    - from: user
      to: api
      data: HTTP Request
    - from: api
      to: user
      data: Response`

const EXAMPLE_FLOW_SUMMARY = {
  id: 'abc123',
  title: 'Simple Flow',
  description: 'A minimal example',
  tags: ['example'],
  version: 1,
  updatedAt: '2026-04-11T12:00:00.000Z',
}

const VALIDATION_ERROR_EXAMPLE = {
  error: 'validation_error',
  details: [
    { path: 'flow.steps[0].to', message: 'Node "nonexistent" not found. Did you mean "api"?', suggestion: 'Change "nonexistent" to "api"' },
  ],
}

const NOT_FOUND_EXAMPLE = {
  error: 'not_found',
  details: [{ path: '', message: 'Flow "xyz" not found' }],
}

export async function flowRoutes(app: FastifyInstance): Promise<void> {
  // Register content type parsers for YAML
  app.addContentTypeParser(
    ['text/yaml', 'application/x-yaml', 'text/x-yaml'],
    { parseAs: 'string' },
    (_req: FastifyRequest, body: string, done: (err: Error | null, result?: unknown) => void) => {
      done(null, body)
    }
  )

  app.addContentTypeParser(
    'text/plain',
    { parseAs: 'string' },
    (_req: FastifyRequest, body: string, done: (err: Error | null, result?: unknown) => void) => {
      done(null, body)
    }
  )

  // ── POST /api/flows — Create a new flow ────────────────────────────
  app.post('/api/flows', {
    schema: {
      summary: 'Create a new flow',
      description: 'Accepts a flow definition in YAML or JSON format. Validates the schema and stores the flow.',
      tags: ['flows'],
      body: {
        type: 'string',
        description: 'Flow definition in YAML or JSON format',
        examples: [EXAMPLE_YAML],
      },
      response: {
        201: {
          type: 'object',
          description: 'Flow created successfully',
          properties: {
            id: { type: 'string', description: 'Unique flow ID', example: 'abc123' },
            version: { type: 'number', description: 'Flow version', example: 1 },
            title: { type: 'string', description: 'Flow title', example: 'Simple Flow' },
          },
        },
        400: {
          type: 'object',
          description: 'Validation error',
          properties: {
            error: { type: 'string', examples: ['validation_error'] },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  path: { type: 'string', example: 'flow.steps[0].to' },
                  message: { type: 'string', example: 'Node "nonexistent" not found. Did you mean "api"?' },
                  suggestion: { type: 'string', example: 'Change "nonexistent" to "api"' },
                },
              },
            },
          },
          example: VALIDATION_ERROR_EXAMPLE,
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const contentType = req.headers['content-type'] ?? ''
    let validationResult

    if (
      contentType.includes('text/yaml') ||
      contentType.includes('application/x-yaml') ||
      contentType.includes('text/x-yaml')
    ) {
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
      validationResult = parseFlowYaml(body)
    } else if (contentType.includes('application/json')) {
      if (typeof req.body === 'string') {
        validationResult = parseFlowJson(req.body)
      } else {
        validationResult = validateFlow(req.body)
      }
    } else {
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
  app.get('/api/flows', {
    schema: {
      summary: 'List all flows',
      description: 'Returns a summary of all stored flows.',
      tags: ['flows'],
      response: {
        200: {
          type: 'array',
          description: 'List of flow summaries',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string', nullable: true },
              tags: { type: 'array', items: { type: 'string' } },
              version: { type: 'number' },
              updatedAt: { type: 'string' },
            },
          },
          example: [EXAMPLE_FLOW_SUMMARY],
        },
      },
    },
  }, async (_req: FastifyRequest, reply: FastifyReply) => {
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
  app.get('/api/flows/:id', {
    schema: {
      summary: 'Get a flow by ID',
      description: 'Returns the full flow definition including metadata, nodes, and steps.',
      tags: ['flows'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Flow ID' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          description: 'Full stored flow',
          properties: {
            id: { type: 'string' },
            flow: { type: 'object', additionalProperties: true, description: 'The flow definition (meta + flow)' },
            version: { type: 'number' },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          description: 'Flow not found',
          properties: {
            error: { type: 'string' },
            details: { type: 'array', items: { type: 'object' } },
          },
          example: NOT_FOUND_EXAMPLE,
        },
      },
    },
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
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
  app.get('/api/flows/:id/version', {
    schema: {
      summary: 'Get flow version',
      description: 'Returns only the version number. Used by the UI for polling.',
      tags: ['flows'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Flow ID' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          description: 'Version number',
          properties: {
            version: { type: 'number', example: 1 },
          },
        },
        404: {
          type: 'object',
          description: 'Flow not found',
          properties: {
            error: { type: 'string' },
            details: { type: 'array', items: { type: 'object' } },
          },
        },
      },
    },
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
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
  app.delete('/api/flows/:id', {
    schema: {
      summary: 'Delete a flow',
      description: 'Permanently deletes a flow by ID.',
      tags: ['flows'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Flow ID' },
        },
        required: ['id'],
      },
      response: {
        204: {
          type: 'null',
          description: 'Flow deleted successfully',
        },
        404: {
          type: 'object',
          description: 'Flow not found',
          properties: {
            error: { type: 'string' },
            details: { type: 'array', items: { type: 'object' } },
          },
        },
      },
    },
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
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
