import { describe, it, expect } from 'vitest'
import { validateFlow } from '../src/validator'
import { parseFlowYaml, parseFlowJson } from '../src/parser'
import { RootSchema } from '../src/schema'

// --- Helpers ---
const minimalFlow = {
  meta: { title: 'Test Flow' },
  flow: {
    nodes: [{ id: 'a', label: 'Node A' }],
  },
}

const fullFlow = {
  meta: {
    title: 'Full Flow',
    description: 'A comprehensive test flow',
    tags: ['test', 'full'],
  },
  flow: {
    nodes: [
      { id: 'user', label: 'User', type: 'actor', icon: 'user', color: '#ff0000' },
      { id: 'api', label: 'API Gateway', type: 'endpoint' },
      { id: 'svc', label: 'Service', type: 'service' },
      { id: 'db', label: 'Database', type: 'database' },
      { id: 'cache', label: 'Cache', type: 'cache' },
      {
        id: 'custom-node',
        label: 'Custom',
        type: 'custom',
        flow: {
          nodes: [
            { id: 'inner-a', label: 'Inner A' },
            { id: 'inner-b', label: 'Inner B' },
          ],
          steps: [{ from: 'inner-a', to: 'inner-b', data: 'inner data' }],
        },
      },
    ],
    steps: [
      { from: 'user', to: 'api', data: 'Request' },
      { from: 'api', to: ['svc', 'cache'], data: { label: 'Broadcast', color: '#00ff00' } },
      {
        parallel: [
          {
            from: 'svc',
            to: 'db',
            data: {
              label: 'Query',
              fields: [
                { name: 'id', type: 'int' },
                { name: 'status', changed: true },
                { name: 'email', added: true },
              ],
            },
          },
          { from: 'svc', to: 'cache', data: 'Check cache' },
        ],
      },
      { from: 'db', to: 'svc', data: 'Response', drilldown: true },
      {
        from: 'api',
        to: 'custom-node',
        data: {
          label: 'Forward',
          fields: [{ name: 'removed_field', removed: true }, { name: 'plain_field' }],
        },
      },
    ],
  },
}

describe('Schema validation', () => {
  it('validates a minimal flow', () => {
    const result = validateFlow(minimalFlow)
    expect(result.success).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.data).toBeDefined()
  })

  it('validates a full flow with all features', () => {
    const result = validateFlow(fullFlow)
    expect(result.success).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects missing required fields', () => {
    const result = validateFlow({ meta: {}, flow: { nodes: [] } })
    expect(result.success).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    // Should report missing title
    expect(
      result.errors.some(
        (e) =>
          e.path.includes('title') ||
          e.message.includes('title') ||
          e.message.includes('Required') ||
          e.message.includes('too_small')
      )
    ).toBe(true)
  })

  it('rejects invalid node type', () => {
    const result = validateFlow({
      meta: { title: 'Test' },
      flow: {
        nodes: [{ id: 'a', label: 'A', type: 'invalid_type' }],
      },
    })
    expect(result.success).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('detects nonexistent node reference with fuzzy suggestion', () => {
    const result = validateFlow({
      meta: { title: 'Test' },
      flow: {
        nodes: [
          { id: 'user', label: 'User' },
          { id: 'api', label: 'API' },
        ],
        steps: [{ from: 'user', to: 'aip', data: 'test' }],
      },
    })
    expect(result.success).toBe(false)
    const err = result.errors.find((e) => e.message.includes('aip'))
    expect(err).toBeDefined()
    expect(err!.suggestion).toMatch(/api/i)
  })

  it('detects duplicate node IDs', () => {
    const result = validateFlow({
      meta: { title: 'Test' },
      flow: {
        nodes: [
          { id: 'dup', label: 'First' },
          { id: 'dup', label: 'Second' },
        ],
      },
    })
    expect(result.success).toBe(false)
    expect(result.errors.some((e) => e.message.includes('Duplicate'))).toBe(true)
  })

  it('validates nested flow recursively', () => {
    const result = validateFlow({
      meta: { title: 'Test' },
      flow: {
        nodes: [
          {
            id: 'parent',
            label: 'Parent',
            flow: {
              nodes: [{ id: 'child', label: 'Child' }],
              steps: [{ from: 'child', to: 'nonexistent', data: 'oops' }],
            },
          },
        ],
      },
    })
    expect(result.success).toBe(false)
    expect(result.errors.some((e) => e.message.includes('nonexistent'))).toBe(true)
  })

  it('accepts data as string', () => {
    const result = validateFlow({
      meta: { title: 'Test' },
      flow: {
        nodes: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
        steps: [{ from: 'a', to: 'b', data: 'simple string' }],
      },
    })
    expect(result.success).toBe(true)
  })

  it('accepts data as object', () => {
    const result = validateFlow({
      meta: { title: 'Test' },
      flow: {
        nodes: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
        steps: [
          {
            from: 'a',
            to: 'b',
            data: { label: 'Payload', color: '#abc', fields: [{ name: 'f1' }] },
          },
        ],
      },
    })
    expect(result.success).toBe(true)
  })

  it('accepts fields without types', () => {
    const result = validateFlow({
      meta: { title: 'Test' },
      flow: {
        nodes: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
        steps: [
          {
            from: 'a',
            to: 'b',
            data: {
              label: 'Data',
              fields: [{ name: 'x' }, { name: 'y', changed: true }],
            },
          },
        ],
      },
    })
    expect(result.success).toBe(true)
  })

  it('accepts broadcast (to as array)', () => {
    const result = validateFlow({
      meta: { title: 'Test' },
      flow: {
        nodes: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
          { id: 'c', label: 'C' },
        ],
        steps: [{ from: 'a', to: ['b', 'c'], data: 'broadcast' }],
      },
    })
    expect(result.success).toBe(true)
  })

  it('accepts parallel steps', () => {
    const result = validateFlow({
      meta: { title: 'Test' },
      flow: {
        nodes: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
          { id: 'c', label: 'C' },
          { id: 'd', label: 'D' },
        ],
        steps: [
          {
            parallel: [
              { from: 'a', to: 'b', data: 'p1' },
              { from: 'c', to: 'd', data: 'p2' },
            ],
          },
        ],
      },
    })
    expect(result.success).toBe(true)
  })
})

describe('YAML parsing', () => {
  it('parses valid YAML to a flow', () => {
    const yaml = `
meta:
  title: YAML Flow
flow:
  nodes:
    - id: a
      label: Node A
    - id: b
      label: Node B
  steps:
    - from: a
      to: b
      data: hello
`
    const result = parseFlowYaml(yaml)
    expect(result.success).toBe(true)
    expect(result.data!.meta.title).toBe('YAML Flow')
  })

  it('returns error for invalid YAML', () => {
    const result = parseFlowYaml('{{invalid yaml')
    expect(result.success).toBe(false)
    expect(result.errors[0].message).toContain('YAML parse error')
  })
})

describe('JSON parsing', () => {
  it('parses valid JSON to a flow', () => {
    const json = JSON.stringify(minimalFlow)
    const result = parseFlowJson(json)
    expect(result.success).toBe(true)
  })

  it('returns error for invalid JSON', () => {
    const result = parseFlowJson('{bad json}')
    expect(result.success).toBe(false)
    expect(result.errors[0].message).toContain('JSON parse error')
  })
})
