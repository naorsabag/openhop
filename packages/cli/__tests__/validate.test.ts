/**
 * Tests for `openhop validate` line/col enrichment.
 *
 * Two layers:
 *   1. Pure helper tests (offsetToLineCol, pathStringToSegments,
 *      resolvePosition) — fast, isolated, no subprocess.
 *   2. End-to-end CLI tests via `tsx src/index.ts validate` — exercise
 *      the commander action including process.exit + JSON output. We run
 *      these through a subprocess because the action calls process.exit
 *      directly and would otherwise tear down the test runner.
 */

import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import YAML from 'yaml'

import {
  offsetToLineCol,
  pathStringToSegments,
  resolvePosition,
} from '../src/validate.js'

const REPO_CLI = join(__dirname, '..')
const ENTRY = join(REPO_CLI, 'src/index.ts')
const TSX = join(REPO_CLI, '../../node_modules/.bin/tsx')

function runCli(args: string[], input?: string): { stdout: string; stderr: string; status: number } {
  const r = spawnSync(TSX, [ENTRY, ...args], {
    input,
    encoding: 'utf-8',
    env: { ...process.env, NO_COLOR: '1' },
  })
  return { stdout: r.stdout, stderr: r.stderr, status: r.status ?? -1 }
}

function withTmpFile<T>(content: string, fn: (path: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'openhop-validate-'))
  const file = join(dir, 'flow.yaml')
  writeFileSync(file, content)
  try {
    return fn(file)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe('pathStringToSegments', () => {
  it('returns [] for an empty path', () => {
    expect(pathStringToSegments('')).toEqual([])
  })

  it('splits dotted zod paths and converts numeric segments to numbers', () => {
    expect(pathStringToSegments('flow.nodes.0.id')).toEqual(['flow', 'nodes', 0, 'id'])
  })

  it('handles bracket-style indices from the semantic validator', () => {
    expect(pathStringToSegments('flow.nodes[2].from')).toEqual(['flow', 'nodes', 2, 'from'])
  })

  it('keeps non-numeric segments as strings', () => {
    expect(pathStringToSegments('meta.title')).toEqual(['meta', 'title'])
  })
})

describe('offsetToLineCol', () => {
  it('returns 1:1 for offset 0', () => {
    expect(offsetToLineCol('hello', 0)).toEqual({ line: 1, col: 1 })
  })

  it('counts columns within the first line', () => {
    expect(offsetToLineCol('abcdef', 3)).toEqual({ line: 1, col: 4 })
  })

  it('advances line on newlines and resets column', () => {
    const src = 'a\nbc\nxyz'
    expect(offsetToLineCol(src, 2)).toEqual({ line: 2, col: 1 }) // 'b'
    expect(offsetToLineCol(src, 5)).toEqual({ line: 3, col: 1 }) // 'x'
    expect(offsetToLineCol(src, 6)).toEqual({ line: 3, col: 2 }) // 'y'
  })

  it('clamps offsets beyond the source length', () => {
    expect(offsetToLineCol('ab', 999).line).toBeGreaterThanOrEqual(1)
  })
})

describe('resolvePosition', () => {
  const yaml = `meta:
  title: Hi
flow:
  nodes:
    - id: a
      label: A
    - id: b
      label: B
`
  const doc = YAML.parseDocument(yaml)

  it('returns the position of the requested node', () => {
    const pos = resolvePosition(doc, yaml, ['meta', 'title'])
    // Line 2, "title" value starts after "  title: "
    expect(pos).toBeDefined()
    expect(pos!.line).toBe(2)
  })

  it('walks into sequences using numeric segments', () => {
    const pos = resolvePosition(doc, yaml, ['flow', 'nodes', 1, 'id'])
    expect(pos).toBeDefined()
    // 2nd node id is on line 7
    expect(pos!.line).toBe(7)
  })

  it('falls back to the parent container when the leaf is missing', () => {
    const pos = resolvePosition(doc, yaml, ['flow', 'nodes', 0, 'nonexistent'])
    expect(pos).toBeDefined() // resolves to the node 0 mapping
  })

  it('returns a position pointing at the first non-whitespace for empty path', () => {
    const pos = resolvePosition(doc, yaml, [])
    expect(pos).toEqual({ line: 1, col: 1 })
  })
})

// ---------------------------------------------------------------------------
// End-to-end CLI behavior
// ---------------------------------------------------------------------------

const VALID_FLOW = `meta:
  title: Hello
flow:
  nodes:
    - id: a
      label: A
    - id: b
      label: B
  steps:
    - from: a
      to: b
      data: ping
`

describe('openhop validate (e2e)', () => {
  it('happy path: valid yaml prints {valid: true} with --json and exits 0', () => {
    withTmpFile(VALID_FLOW, (file) => {
      const r = runCli(['validate', file, '--json'])
      expect(r.status).toBe(0)
      expect(JSON.parse(r.stdout)).toEqual({ valid: true })
    })
  })

  it('invalid yaml: error carries line + col matching the source position', () => {
    // Make the second node missing its required `label` — zod will complain
    // about the object at flow.nodes.1.
    const bad = `meta:
  title: T
flow:
  nodes:
    - id: a
      label: A
    - id: b
`
    withTmpFile(bad, (file) => {
      const r = runCli(['validate', file, '--json'])
      expect(r.status).toBe(3)
      const out = JSON.parse(r.stdout)
      expect(out.valid).toBe(false)
      expect(Array.isArray(out.errors)).toBe(true)
      expect(out.errors.length).toBeGreaterThan(0)
      // At least one error should land on the node-2 region (lines 7-8).
      const positioned = out.errors.filter(
        (e: { line?: number }) => typeof e.line === 'number'
      )
      expect(positioned.length).toBeGreaterThan(0)
      const lines = positioned.map((e: { line: number }) => e.line)
      expect(Math.min(...lines)).toBeGreaterThanOrEqual(5)
    })
  })

  it('typo in step ref: suggestion is preserved alongside line/col', () => {
    const typo = `meta:
  title: T
flow:
  nodes:
    - id: client
      label: C
    - id: api
      label: A
  steps:
    - from: clientt
      to: api
      data: hi
`
    withTmpFile(typo, (file) => {
      const r = runCli(['validate', file, '--json'])
      expect(r.status).toBe(3)
      const out = JSON.parse(r.stdout)
      const fromErr = out.errors.find((e: { path: string }) =>
        e.path.includes('from')
      )
      expect(fromErr).toBeDefined()
      expect(fromErr.suggestion).toMatch(/Did you mean "client"/)
      // line/col should be set since the path resolves.
      expect(typeof fromErr.line).toBe('number')
      expect(typeof fromErr.col).toBe('number')
    })
  })

  it('synthesized error (YAML parse error → empty path): does not crash, line/col may be 1:1 or undefined', () => {
    // Trigger a YAML parse error — parseFlowYaml returns a single error with
    // path:''. Our helper should resolve that to the start of the document
    // rather than crash.
    const broken = `meta:
  title: "unterminated
flow:
  nodes: []
`
    withTmpFile(broken, (file) => {
      const r = runCli(['validate', file, '--json'])
      expect(r.status).toBe(3)
      const out = JSON.parse(r.stdout)
      expect(out.valid).toBe(false)
      expect(out.errors.length).toBeGreaterThan(0)
      // line/col should either be undefined or a sane integer — never NaN.
      for (const e of out.errors) {
        if (e.line !== undefined) expect(Number.isInteger(e.line)).toBe(true)
        if (e.col !== undefined) expect(Number.isInteger(e.col)).toBe(true)
      }
    })
  })

  it('human-mode output includes line:col when present', () => {
    const bad = `meta:
  title: T
flow:
  nodes:
    - id: a
      label: A
    - id: b
`
    withTmpFile(bad, (file) => {
      const r = runCli(['validate', file])
      expect(r.status).toBe(3)
      // Match a "<path>:<line>:<col>:" segment somewhere in stderr.
      expect(r.stderr).toMatch(/:\d+:\d+:/)
    })
  })
})
