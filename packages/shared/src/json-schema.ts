/**
 * JSON Schema — auto-generated from Zod schemas.
 * Single source of truth is schema.ts (Zod).
 * Used by: Swagger/OpenAPI docs, AI skill file.
 */

import { toJSONSchema } from 'zod'
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

export const rootJsonSchema = toJSONSchema(RootSchema)
export const metaJsonSchema = toJSONSchema(MetaSchema)
export const flowJsonSchema = toJSONSchema(FlowSchema)
export const nodeJsonSchema = toJSONSchema(NodeSchema)
export const stepJsonSchema = toJSONSchema(StepSchema)
export const moveStepJsonSchema = toJSONSchema(MoveStepSchema)
export const fieldJsonSchema = toJSONSchema(FieldSchema)
export const dataObjectJsonSchema = toJSONSchema(DataObjectSchema)
export const dataJsonSchema = toJSONSchema(DataSchema)

/**
 * Full stored flow as returned by GET /api/flows/:id
 */
export const storedFlowJsonSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', description: 'Flow ID' },
    meta: metaJsonSchema,
    flow: flowJsonSchema,
    version: { type: 'number', description: 'Version counter' },
    createdAt: { type: 'string', description: 'ISO timestamp' },
    updatedAt: { type: 'string', description: 'ISO timestamp' },
  },
  required: ['id', 'meta', 'flow', 'version', 'createdAt', 'updatedAt'],
}

/**
 * Flow list item summary
 */
export const flowSummaryJsonSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string', nullable: true },
    tags: { type: 'array', items: { type: 'string' } },
    path: { type: 'string', nullable: true },
    version: { type: 'number' },
    updatedAt: { type: 'string' },
  },
}

/**
 * Patch operations schema
 */
export const patchOperationsJsonSchema = toJSONSchema(patchSchema)

/** Example for documentation */
export const patchOperationsExample = {
  operations: [
    { op: 'add-nodes', nodes: [{ id: 'cache', label: 'Redis', type: 'cache' }] },
    { op: 'rename-nodes', nodes: [{ id: 'api', label: 'API v2' }] },
  ],
}
