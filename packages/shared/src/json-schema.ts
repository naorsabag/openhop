/**
 * JSON Schema — auto-generated from Zod schemas.
 * Single source of truth is schema.ts (Zod).
 * Used by: Swagger/OpenAPI docs, AI skill file.
 */

import { zodToJsonSchema } from 'zod-to-json-schema'
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

export const rootJsonSchema = zodToJsonSchema(RootSchema, { target: 'openApi3' })
export const metaJsonSchema = zodToJsonSchema(MetaSchema, { target: 'openApi3' })
export const flowJsonSchema = zodToJsonSchema(FlowSchema, { target: 'openApi3' })
export const nodeJsonSchema = zodToJsonSchema(NodeSchema, { target: 'openApi3' })
export const stepJsonSchema = zodToJsonSchema(StepSchema, { target: 'openApi3' })
export const moveStepJsonSchema = zodToJsonSchema(MoveStepSchema, { target: 'openApi3' })
export const fieldJsonSchema = zodToJsonSchema(FieldSchema, { target: 'openApi3' })
export const dataObjectJsonSchema = zodToJsonSchema(DataObjectSchema, { target: 'openApi3' })
export const dataJsonSchema = zodToJsonSchema(DataSchema, { target: 'openApi3' })

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
import { patchSchema } from './patch.js'

export const patchOperationsJsonSchema = zodToJsonSchema(patchSchema, { target: 'openApi3' })

/** Example for documentation */
export const patchOperationsExample = {
  operations: [
    { op: 'add-nodes', nodes: [{ id: 'cache', label: 'Redis', type: 'cache' }] },
    { op: 'rename-nodes', nodes: [{ id: 'api', label: 'API v2' }] },
  ],
}
