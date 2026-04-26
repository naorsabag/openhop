import { describe, it, expect } from 'vitest'
import {
  rootJsonSchema,
  metaJsonSchema,
  flowJsonSchema,
  nodeJsonSchema,
  stepJsonSchema,
  moveStepJsonSchema,
  fieldJsonSchema,
  dataObjectJsonSchema,
  dataJsonSchema,
  storedFlowJsonSchema,
  flowSummaryJsonSchema,
  patchOperationsJsonSchema,
  patchOperationsExample,
  sharedJsonSchemas,
  schemaId,
} from '../src/json-schema'

describe('json-schema', () => {
  describe('schemaId', () => {
    it('prefixes the openhop.dev schema namespace', () => {
      expect(schemaId('root')).toBe('https://openhop.dev/schemas/root')
      expect(schemaId('meta')).toBe('https://openhop.dev/schemas/meta')
    })
  })

  describe('emitted schemas', () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['root', rootJsonSchema],
      ['meta', metaJsonSchema],
      ['flow', flowJsonSchema],
      ['node', nodeJsonSchema],
      ['step', stepJsonSchema],
      ['move-step', moveStepJsonSchema],
      ['field', fieldJsonSchema],
      ['data-object', dataObjectJsonSchema],
      ['data', dataJsonSchema],
      ['patch-operations', patchOperationsJsonSchema],
    ]

    it.each(cases)('emits %s with the right $id', (name, schema) => {
      expect(schema.$id).toBe(`https://openhop.dev/schemas/${name}`)
    })

    it.each(cases)('strips $schema from %s (would conflict with Ajv default)', (_, schema) => {
      expect(schema.$schema).toBeUndefined()
    })

    it('strips additionalProperties:false from emitted schemas', () => {
      // Visit recursively and confirm no `additionalProperties: false` lingers.
      const visit = (node: unknown): boolean => {
        if (Array.isArray(node)) return node.every(visit)
        if (!node || typeof node !== 'object') return true
        const obj = node as Record<string, unknown>
        if (obj.additionalProperties === false) return false
        return Object.values(obj).every(visit)
      }
      expect(visit(rootJsonSchema)).toBe(true)
      expect(visit(flowJsonSchema)).toBe(true)
      expect(visit(stepJsonSchema)).toBe(true)
    })
  })

  describe('storedFlowJsonSchema', () => {
    it('references meta and flow by $id rather than inlining them', () => {
      const props = storedFlowJsonSchema.properties as Record<string, { $ref?: string }>
      expect(props.meta.$ref).toBe(schemaId('meta'))
      expect(props.flow.$ref).toBe(schemaId('flow'))
    })

    it('lists every required field', () => {
      expect(storedFlowJsonSchema.required).toEqual([
        'id',
        'meta',
        'flow',
        'version',
        'createdAt',
        'updatedAt',
      ])
    })
  })

  describe('flowSummaryJsonSchema', () => {
    it('declares the summary fields with id and title required', () => {
      expect(flowSummaryJsonSchema.type).toBe('object')
      const props = flowSummaryJsonSchema.properties as Record<string, unknown>
      expect(Object.keys(props)).toEqual([
        'id',
        'title',
        'description',
        'path',
        'version',
        'updatedAt',
      ])
    })
  })

  describe('sharedJsonSchemas', () => {
    it('contains every schema that needs central registration', () => {
      expect(sharedJsonSchemas).toHaveLength(8)
      const ids = sharedJsonSchemas.map((s) => (s as { $id: string }).$id)
      expect(ids).toContain(schemaId('meta'))
      expect(ids).toContain(schemaId('flow'))
      expect(ids).toContain(schemaId('node'))
      expect(ids).toContain(schemaId('step'))
    })
  })

  describe('patchOperationsExample', () => {
    it('illustrates add-nodes and rename-nodes shapes', () => {
      expect(patchOperationsExample.operations).toHaveLength(2)
      expect(patchOperationsExample.operations[0].op).toBe('add-nodes')
      expect(patchOperationsExample.operations[1].op).toBe('rename-nodes')
    })
  })
})
