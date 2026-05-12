import { describe, expect, it } from 'vitest'
import LZString from 'lz-string'
import YAML from 'yaml'
import { deflateSync } from 'fflate'
import { parseFlowYaml } from '@openhop/shared'
import { buildShareUrl, decodeFragment, encodeFragment } from '../src/lib/share-url'

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  // btoa is available in vitest's jsdom env
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

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
  it('round-trips a typical flow (semantically — minification rewrites whitespace)', () => {
    const enc = encodeFragment(SAMPLE_YAML)
    expect(enc).not.toContain(' ')
    expect(enc).not.toContain('\n')
    const dec = decodeFragment(enc)
    expect(dec).not.toBeNull()
    // YAML stringify may pick a different indent / quoting style, so compare
    // the parsed objects rather than the raw text.
    expect(YAML.parse(dec!)).toEqual(YAML.parse(SAMPLE_YAML))
    expect(parseFlowYaml(dec ?? '').success).toBe(true)
  })

  it('emits the v1 prefix (~1) for new shares', () => {
    expect(encodeFragment(SAMPLE_YAML).startsWith('~1')).toBe(true)
  })

  it('compresses meaningfully — encoded form is shorter than the raw YAML', () => {
    const enc = encodeFragment(SAMPLE_YAML)
    expect(enc.length).toBeLessThan(SAMPLE_YAML.length)
  })

  it('new format is shorter than the legacy lz-string form for typical input', () => {
    const v1 = encodeFragment(SAMPLE_YAML)
    const v0 = LZString.compressToEncodedURIComponent(SAMPLE_YAML)
    expect(v1.length).toBeLessThan(v0.length)
  })

  it('still decodes legacy lz-string fragments (backward compat for old share URLs)', () => {
    const legacy = LZString.compressToEncodedURIComponent(SAMPLE_YAML)
    const dec = decodeFragment(legacy)
    // Legacy v0 returns the YAML verbatim (no minify step on decode), so
    // string-equality holds in this direction.
    expect(dec).toBe(SAMPLE_YAML)
  })

  it('decodes empty / missing fragment to null', () => {
    expect(decodeFragment('')).toBeNull()
  })

  it('decodes garbage to null (caller renders the corrupted-link banner)', () => {
    expect(decodeFragment('this-is-not-lz-encoded')).toBeNull()
    expect(decodeFragment('!!!~~~')).toBeNull()
    // v1 prefix with junk after it — the base64 might decode but inflate
    // will fail.
    expect(decodeFragment('~1!!!not-base64!!!')).toBeNull()
  })

  it('refuses oversized v1 fragments (compressed-input cap)', () => {
    // 80 KB of random-ish bytes; well above the 64 KB compressed cap. Doesn't
    // even need to be a real DEFLATE stream — the length check fires first.
    const bomb = new Uint8Array(80 * 1024).map((_, i) => (i * 31) & 0xff)
    expect(decodeFragment('~1' + toBase64Url(bomb))).toBeNull()
  })

  it('refuses decompression bombs (inflated-output cap)', () => {
    // 2 MB of zeros DEFLATE-compresses to ~2 KB — fits under the input cap
    // but blows past the 1 MB inflated cap.
    const oversized = deflateSync(new Uint8Array(2 * 1024 * 1024), { level: 9 })
    expect(decodeFragment('~1' + toBase64Url(oversized))).toBeNull()
  })

  it('buildShareUrl uses Vite BASE_URL so dev (/) and Pages (/openhop/) both work', () => {
    const dev = buildShareUrl(SAMPLE_YAML, 'http://localhost:8788', '/')
    expect(dev).toMatch(/^http:\/\/localhost:8788\/#~1[A-Za-z0-9_-]+$/)

    const pages = buildShareUrl(SAMPLE_YAML, 'https://naorsabag.github.io', '/openhop/')
    expect(pages).toMatch(/^https:\/\/naorsabag\.github\.io\/openhop\/#~1[A-Za-z0-9_-]+$/)

    // Hash content matches encodeFragment for both URLs (proves the BASE_URL
    // only affects the path, never the encoded payload).
    const expectedHash = encodeFragment(SAMPLE_YAML)
    expect(dev.endsWith(`#${expectedHash}`)).toBe(true)
    expect(pages.endsWith(`#${expectedHash}`)).toBe(true)
  })
})
