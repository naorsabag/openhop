import { describe, it, expect } from 'vitest'
import { validateRenderOptions, validateYaml, EXIT } from '../src/render'

describe('validateRenderOptions', () => {
  it('rejects missing file', () => {
    const r = validateRenderOptions(undefined, { format: 'png', output: 'x.png' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe(EXIT.USAGE)
      expect(r.message).toMatch(/file/)
    }
  })

  it('rejects missing --format', () => {
    const r = validateRenderOptions('flow.yaml', { output: 'x.png' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe(EXIT.USAGE)
  })

  it('rejects missing --output', () => {
    const r = validateRenderOptions('flow.yaml', { format: 'png' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe(EXIT.USAGE)
  })

  it('rejects unsupported formats (svg, url, gif)', () => {
    for (const fmt of ['svg', 'url', 'gif', 'jpeg']) {
      const r = validateRenderOptions('flow.yaml', { format: fmt, output: 'x.out' })
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.code).toBe(EXIT.USAGE)
        expect(r.message).toMatch(/unsupported format/)
      }
    }
  })

  it('accepts png', () => {
    const r = validateRenderOptions('flow.yaml', { format: 'png', output: 'x.png' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.format).toBe('png')
  })

  it('accepts mp4', () => {
    const r = validateRenderOptions('flow.yaml', { format: 'mp4', output: 'x.mp4' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.format).toBe('mp4')
  })
})

describe('validateYaml', () => {
  it('returns null for a valid flow', () => {
    const yaml = `
meta:
  title: example
flow:
  nodes:
    - id: a
      type: service
      label: A
    - id: b
      type: service
      label: B
  steps:
    - from: a
      to: b
      data: hello
`
    const err = validateYaml(yaml)
    expect(err).toBeNull()
  })

  it('returns a multi-line message for invalid YAML', () => {
    const yaml = `nodses: []`
    const err = validateYaml(yaml)
    expect(err).not.toBeNull()
    expect(err).toMatch(/invalid flow YAML/)
  })

  it('returns a message for completely malformed YAML', () => {
    const yaml = `: : : not yaml at all : :\n  - [`
    const err = validateYaml(yaml)
    expect(err).not.toBeNull()
  })
})

describe('EXIT codes', () => {
  it('matches the documented contract', () => {
    expect(EXIT.OK).toBe(0)
    expect(EXIT.GENERIC).toBe(1)
    expect(EXIT.USAGE).toBe(2)
    expect(EXIT.VALIDATION).toBe(3)
    expect(EXIT.NETWORK).toBe(6)
  })
})
