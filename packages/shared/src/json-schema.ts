/**
 * JSON Schema — auto-generated from Zod schemas.
 * Single source of truth is schema.ts (Zod).
 * Used by: Swagger/OpenAPI docs, AI skill file.
 */

import { toJSONSchema as zodToJson, type ZodType } from 'zod'
import {
  RootSchema,
  MetaSchema,
  FlowSchema,
  NodeSchema,
  StepSchema,
  MoveStepSchema,
  FieldSchema,
  DataObjectSchema,
  DataSchema,
} from './schema.js'
import { patchSchema } from './patch.js'

// Fastify's bundled Ajv doesn't load the 2020-12 meta-schema, so we emit
// draft-7 which Ajv understands out of the box.
// Give each emitted schema its own `$id`. Per JSON Schema draft-7, a subschema
// with `$id` establishes a new base URI, so internal `$ref: "#"` resolves to
// that subschema's root — not the embedding document's root. This is what keeps
// the recursive sub-flow reference correct when flowJsonSchema sits inside
// storedFlowJsonSchema. Also strips `additionalProperties: false`, which zod 4
// emits by default and which fast-json-stringify handles awkwardly for unions.
const ID_NS = 'https://openhop.dev/schemas/'

const stripStrictFlag = (node: unknown): unknown => {
  if (Array.isArray(node)) return node.map(stripStrictFlag)
  if (!node || typeof node !== 'object') return node
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k === 'additionalProperties' && v === false) continue
    out[k] = stripStrictFlag(v)
  }
  return out
}

export const schemaId = (name: string) => `${ID_NS}${name}`

const emit = (schema: ZodType, name: string): Record<string, unknown> => {
  const raw = zodToJson(schema, { target: 'draft-7' }) as Record<string, unknown>
  delete raw.$schema
  return { $id: schemaId(name), ...(stripStrictFlag(raw) as Record<string, unknown>) }
}

export const rootJsonSchema = emit(RootSchema, 'root')
export const metaJsonSchema = emit(MetaSchema, 'meta')
export const flowJsonSchema = emit(FlowSchema, 'flow')
export const nodeJsonSchema = emit(NodeSchema, 'node')
export const stepJsonSchema = emit(StepSchema, 'step')
export const moveStepJsonSchema = emit(MoveStepSchema, 'move-step')
export const fieldJsonSchema = emit(FieldSchema, 'field')
export const dataObjectJsonSchema = emit(DataObjectSchema, 'data-object')
export const dataJsonSchema = emit(DataSchema, 'data')

/**
 * Full stored flow as returned by GET /api/flows/:id.
 * Nested schemas are referenced by $id so we never inline `flowJsonSchema`
 * (which contains a recursive `$ref: "#"` that would otherwise re-bind to the
 * stored-flow root at validation time). The server registers each shared
 * schema once via `app.addSchema(...)` in bootstrap.
 */
export const storedFlowJsonSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', description: 'Flow ID' },
    meta: { $ref: schemaId('meta') },
    flow: { $ref: schemaId('flow') },
    version: { type: 'number', description: 'Version counter' },
    createdAt: { type: 'string', description: 'ISO timestamp' },
    updatedAt: { type: 'string', description: 'ISO timestamp' },
  },
  required: ['id', 'meta', 'flow', 'version', 'createdAt', 'updatedAt'],
}

/** Schemas that must be registered centrally via `app.addSchema(...)` before
 * any route that references them is compiled. */
export const sharedJsonSchemas = [
  metaJsonSchema,
  flowJsonSchema,
  nodeJsonSchema,
  stepJsonSchema,
  moveStepJsonSchema,
  fieldJsonSchema,
  dataObjectJsonSchema,
  dataJsonSchema,
]

/**
 * Flow list item summary
 */
export const flowSummaryJsonSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string', nullable: true },
    path: { type: 'string', nullable: true },
    version: { type: 'number' },
    updatedAt: { type: 'string' },
  },
}

/**
 * Patch operations schema
 */
export const patchOperationsJsonSchema = emit(patchSchema, 'patch-operations')

/** Example for documentation */
export const patchOperationsExample = {
  operations: [
    { op: 'add-nodes', nodes: [{ id: 'cache', label: 'Redis', type: 'cache' }] },
    { op: 'rename-nodes', nodes: [{ id: 'api', label: 'API v2' }] },
  ],
}
