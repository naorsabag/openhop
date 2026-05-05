import { describe, expect, it } from 'vitest'
import { parseFlowYaml } from '@openhop/shared'
import { buildShareUrl, decodeFragment, encodeFragment } from '../src/lib/share-url'

const SAMPLE_YAML = `meta:
  title: Round-trip
  path: demos
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

describe('share-url encode/decode', () => {
  it('round-trips a typical flow', () => {
    const enc = encodeFragment(SAMPLE_YAML)
    expect(enc).not.toContain(' ')
    expect(enc).not.toContain('\n')
    const dec = decodeFragment(enc)
    expect(dec).toBe(SAMPLE_YAML)
    // And the round-tripped YAML still validates against the schema.
    expect(parseFlowYaml(dec ?? '').success).toBe(true)
  })

  it('compresses well — typical flow encodes to fewer than the raw byte count', () => {
    // Locks in that the lz-string variant is actually denser than the raw
    // bytes for representative input. (URL-safe base64 of raw text would be
    // ~1.34× — lz-string typically wins by ~3× on YAML's repetitive shape.)
    const enc = encodeFragment(SAMPLE_YAML)
    expect(enc.length).toBeLessThan(SAMPLE_YAML.length)
  })

  it('decodes empty / missing fragment to null', () => {
    expect(decodeFragment('')).toBeNull()
  })

  it('decodes garbage to null (caller renders the corrupted-link banner)', () => {
    expect(decodeFragment('this-is-not-lz-encoded')).toBeNull()
    expect(decodeFragment('!!!~~~')).toBeNull()
  })

  it('buildShareUrl uses Vite BASE_URL so dev (/) and Pages (/OpenHop/) both work', () => {
    const dev = buildShareUrl(SAMPLE_YAML, 'http://localhost:8788', '/')
    expect(dev).toMatch(/^http:\/\/localhost:8788\/#[A-Za-z0-9_+\-$.]+$/)

    const pages = buildShareUrl(SAMPLE_YAML, 'https://naorsabag.github.io', '/OpenHop/')
    expect(pages).toMatch(/^https:\/\/naorsabag\.github\.io\/OpenHop\/#[A-Za-z0-9_+\-$.]+$/)

    // Hash content matches encodeFragment for both URLs (proves the BASE_URL
    // only affects the path, never the encoded payload).
    const expectedHash = encodeFragment(SAMPLE_YAML)
    expect(dev.endsWith(`#${expectedHash}`)).toBe(true)
    expect(pages.endsWith(`#${expectedHash}`)).toBe(true)
  })
})
