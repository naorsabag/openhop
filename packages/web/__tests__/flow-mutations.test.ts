import { describe, expect, it } from 'vitest'
import YAML from 'yaml'
import { parseFlowYaml } from '@openhop/shared'
import { buildStarterYaml } from '../src/components/FlowEditorModal'

const VALID_YAML = `meta:
  title: Test
flow:
  nodes:
    - id: a
      label: A
      type: actor
    - id: b
      label: B
      type: endpoint
  steps:
    - from: a
      to: b
      data: req
`

describe('FlowEditorModal validation handshake', () => {
  it('passes parseFlowYaml on the canned starter YAML used for "+ New flow"', () => {
    // Mirror the STARTER_YAML constant in FlowEditorModal so the green-on-open
    // promise from #74 ("opens with valid starter YAML") doesn't regress.
    const STARTER_YAML = `meta:
  title: New flow
flow:
  nodes:
    - id: browser
      label: Browser
      type: actor
    - id: api
      label: API
      type: endpoint
  steps:
    - from: browser
      to: api
      data: request
    - from: api
      to: browser
      data: response
`
    const result = parseFlowYaml(STARTER_YAML)
    expect(result.success).toBe(true)
  })

  it('reports path + message + suggestion for an unknown step ref', () => {
    const bad = `meta:
  title: T
flow:
  nodes:
    - id: a
      label: A
      type: actor
  steps:
    - from: a
      to: nonexistent
      data: x
`
    const result = parseFlowYaml(bad)
    expect(result.success).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    const err = result.errors[0]
    expect(err.path).toBeTruthy()
    expect(err.message.toLowerCase()).toContain('node')
  })

  it('returns a validation error when the YAML is malformed / empty', () => {
    const result = parseFlowYaml('::: not yaml')
    expect(result.success).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('round-trips a stored flow through YAML.stringify → YAML.parse without lossy schema changes', () => {
    // The Edit-mode pre-population uses YAML.stringify({ meta, flow }) on the
    // server response. This test locks in that the round-trip preserves the
    // shape parseFlowYaml accepts — i.e. the user's first keystroke in the
    // editor doesn't fail validation just from the round-trip.
    const stored = {
      meta: { title: 'Round trip', description: 'A test' },
      flow: {
        nodes: [
          { id: 'a', label: 'A', type: 'actor' as const },
          { id: 'b', label: 'B', type: 'endpoint' as const },
        ],
        steps: [{ from: 'a', to: 'b', data: 'req' }],
      },
    }
    const yamlText = YAML.stringify(stored)
    const reparsed = parseFlowYaml(yamlText)
    expect(reparsed.success).toBe(true)
    expect(reparsed.data?.meta.title).toBe('Round trip')
    expect(reparsed.data?.flow.nodes).toHaveLength(2)
  })

  it('canned VALID_YAML is what the e2e fetch test would POST', () => {
    expect(parseFlowYaml(VALID_YAML).success).toBe(true)
  })
})

describe('handleDeleteFolder descendant match — what gets bulk-deleted', () => {
  // Mirror the predicate in App.handleDeleteFolder: a flow is in the folder
  // when its path equals the folder OR starts with `${folder}/`. Locking the
  // semantics so "delete folder billing" doesn't accidentally take billing-x
  // or x/billing.
  const inFolder = (folderPath: string, flowPath: string | undefined): boolean =>
    flowPath === folderPath || (flowPath ?? '').startsWith(`${folderPath}/`)

  it('matches the folder itself', () => {
    expect(inFolder('billing', 'billing')).toBe(true)
  })

  it('matches descendants of the folder', () => {
    expect(inFolder('billing', 'billing/refunds')).toBe(true)
    expect(inFolder('billing', 'billing/refunds/q1')).toBe(true)
  })

  it('does NOT match siblings with the folder name as a prefix', () => {
    expect(inFolder('billing', 'billing-tax')).toBe(false)
    expect(inFolder('billing', 'billing2')).toBe(false)
  })

  it('does NOT match unrelated paths or root flows', () => {
    expect(inFolder('billing', 'orders')).toBe(false)
    expect(inFolder('billing', undefined)).toBe(false) // a flow at the root
  })

  it('does NOT match folder appearing as a non-prefix segment', () => {
    expect(inFolder('billing', 'eu/billing')).toBe(false)
  })
})

describe('buildStarterYaml — path injection for the per-folder "+" menu', () => {
  it('omits meta.path when no folder is provided (root creation)', () => {
    const yamlText = buildStarterYaml()
    const parsed = parseFlowYaml(yamlText)
    expect(parsed.success).toBe(true)
    const meta = (YAML.parse(yamlText) as { meta: { path?: string } }).meta
    expect(meta.path).toBeUndefined()
  })

  it('injects meta.path when called with a folder path', () => {
    const yamlText = buildStarterYaml('billing/payments')
    const parsed = parseFlowYaml(yamlText)
    expect(parsed.success).toBe(true)
    const meta = (YAML.parse(yamlText) as { meta: { path?: string } }).meta
    expect(meta.path).toBe('billing/payments')
  })

  it('preserves path through nested folder creation (folder-then-flow)', () => {
    // Sidebar's handleCreateAt('folder', 'billing') prompts for a name, splices
    // it onto the parent path, and calls buildStarterYaml('billing/<name>').
    const yamlText = buildStarterYaml('billing/refunds')
    const meta = (YAML.parse(yamlText) as { meta: { path?: string } }).meta
    expect(meta.path).toBe('billing/refunds')
  })
})
