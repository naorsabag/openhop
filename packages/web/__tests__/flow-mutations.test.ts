import { describe, expect, it } from 'vitest'
import YAML from 'yaml'
import { parseFlowYaml } from '@openhop/shared'

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
