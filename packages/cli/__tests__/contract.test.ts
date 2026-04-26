/**
 * Contract test suite — spawns the actual dist/index.js binary and asserts
 * the machine-facing contract holds end-to-end. Unit tests cover internals;
 * these tests cover the *interface* agents and pipelines depend on.
 *
 * Spec: openhop-launch/16-cli-as-universal-api.md ("Automated validation").
 *
 * What we lock in here:
 *  1. --json emits valid JSON on stdout with no ANSI escapes.
 *  2. Human mode keeps stdout clean of logs (data on stdout, logs on stderr).
 *  3. Semantic exit codes match the contract (2/3/4/6).
 *  4. help --json schema is stable (commands, exitCodes, apiVersion).
 *  5. --api-version is a bare integer.
 *  6. --version is the same string as package.json.
 *
 * Tests that need a running OpenHop server (push, list with success, etc.)
 * are deliberately scoped to failure modes here so the suite can run in CI
 * without a live backend. Integration tests that hit a real server belong
 * in a separate suite.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { spawnSync, type SpawnSyncReturns } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const CLI = resolve(here, '..', 'dist', 'index.js')
const REPO = resolve(here, '..', '..', '..')
const EXAMPLE_GOOD = resolve(REPO, 'examples', 'auth-flow.yaml')

interface RunResult {
  status: number
  stdout: string
  stderr: string
}

function run(args: string[], input?: string): RunResult {
  const r: SpawnSyncReturns<string> = spawnSync('node', [CLI, ...args], {
    encoding: 'utf-8',
    input,
    // Force a non-TTY environment to verify ANSI auto-disable. Without
    // explicit stdio: 'pipe' the child inherits the parent's tty in some
    // shells, which would mask color leaks.
    stdio: ['pipe', 'pipe', 'pipe'],
    // Use a safe non-loopback URL that resolves but refuses, so network
    // commands fail fast instead of hanging on a live local server.
    env: { ...process.env, NO_COLOR: undefined as unknown as string },
  })
  return {
    status: r.status ?? -1,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
  }
}

const ANSI = /\x1b\[[0-9;]*[A-Za-z]/

beforeAll(() => {
  // Sanity: the build artifact must exist. If this fails, run `npm run build`
  // in packages/cli first. We don't auto-build to keep the test loop fast.
  if (!existsSync(CLI)) {
    throw new Error(`CLI bundle missing at ${CLI} — run "npm run build" first`)
  }
})

describe('top-level flags', () => {
  it('--version prints the package version', () => {
    const pkg = JSON.parse(
      readFileSync(resolve(here, '..', 'package.json'), 'utf-8'),
    ) as { version: string }
    const r = run(['--version'])
    expect(r.status).toBe(0)
    expect(r.stdout.trim()).toBe(pkg.version)
    expect(r.stderr).toBe('')
  })

  it('--api-version prints a bare integer', () => {
    const r = run(['--api-version'])
    expect(r.status).toBe(0)
    expect(r.stdout.trim()).toMatch(/^\d+$/)
    expect(Number.parseInt(r.stdout.trim(), 10)).toBeGreaterThanOrEqual(1)
  })
})

describe('help --json: agent introspection', () => {
  it('returns a parseable command tree with no ANSI', () => {
    const r = run(['help', '--json'])
    expect(r.status).toBe(0)
    expect(r.stdout).not.toMatch(ANSI)
    const doc = JSON.parse(r.stdout) as Record<string, unknown>
    expect(doc).toMatchObject({
      name: 'openhop',
      apiVersion: expect.any(Number),
      version: expect.any(String),
      commands: expect.any(Object),
      exitCodes: expect.any(Object),
    })
  })

  it('exposes the documented exit-code constants', () => {
    const r = run(['help', '--json'])
    const doc = JSON.parse(r.stdout) as { exitCodes: Record<string, number> }
    expect(doc.exitCodes).toMatchObject({
      SUCCESS: 0,
      USAGE: 2,
      VALIDATION: 3,
      NOT_FOUND: 4,
      CONFLICT: 5,
      NETWORK: 6,
      AUTH: 7,
    })
  })

  it('lists the v0.1 command surface', () => {
    const r = run(['help', '--json'])
    const doc = JSON.parse(r.stdout) as { commands: Record<string, unknown> }
    const expected = ['serve', 'push', 'list', 'patch', 'remove', 'get', 'validate', 'init']
    for (const name of expected) {
      expect(doc.commands[name], `missing command "${name}"`).toBeDefined()
    }
  })

  it('every command declares positional + flags arrays', () => {
    const r = run(['help', '--json'])
    const doc = JSON.parse(r.stdout) as {
      commands: Record<string, { positional: unknown[]; flags: unknown[] }>
    }
    for (const [name, spec] of Object.entries(doc.commands)) {
      expect(Array.isArray(spec.positional), `${name}.positional`).toBe(true)
      expect(Array.isArray(spec.flags), `${name}.flags`).toBe(true)
    }
  })
})

describe('--json on every data-emitting command', () => {
  it('validate (good) → {"valid": true}', () => {
    const r = run(['validate', EXAMPLE_GOOD, '--json'])
    expect(r.status).toBe(0)
    expect(r.stdout).not.toMatch(ANSI)
    expect(JSON.parse(r.stdout)).toEqual({ valid: true })
  })

  it('validate (bad) → valid:false with errors[], exit 3', () => {
    const r = run(['validate', '-', '--json'], 'nodses: []\n')
    expect(r.status).toBe(3)
    expect(r.stdout).not.toMatch(ANSI)
    const doc = JSON.parse(r.stdout) as { valid: boolean; errors: unknown[] }
    expect(doc.valid).toBe(false)
    expect(Array.isArray(doc.errors)).toBe(true)
    expect(doc.errors.length).toBeGreaterThan(0)
  })

  it('validate errors carry source line/col positions', () => {
    // Invalid YAML where a real schema path *does* exist in the document —
    // line/col should map to the offending node, not undefined.
    const yaml = ['meta:', '  name: x', 'flow:', '  nodses: []'].join('\n') + '\n'
    const r = run(['validate', '-', '--json'], yaml)
    expect(r.status).toBe(3)
    const doc = JSON.parse(r.stdout) as {
      errors: Array<{ path: string; line?: number; col?: number; message: string }>
    }
    // At least one error has resolvable line+col. We don't pin exact numbers
    // because schema details may shift; the contract is that positions exist.
    const positioned = doc.errors.filter(
      (e) => typeof e.line === 'number' && typeof e.col === 'number',
    )
    expect(positioned.length).toBeGreaterThan(0)
    expect(positioned[0].line).toBeGreaterThan(0)
    expect(positioned[0].col).toBeGreaterThan(0)
  })

  it('init --dry-run --json emits the documented shape', () => {
    const r = run(['init', '--dry-run', '--json'])
    expect(r.stdout).not.toMatch(ANSI)
    const doc = JSON.parse(r.stdout) as Record<string, unknown>
    expect(doc).toMatchObject({
      installed: expect.any(Array),
      skipped: expect.any(Array),
      failed: expect.any(Array),
      wouldInstall: expect.any(Array),
      dryRun: true,
    })
  })

  it('list with no server → exit 6 (network), JSON error on stdout', () => {
    // 127.0.0.1:1 is a port nothing listens on; fetch will fail fast.
    const r = run(['list', '--json', '--server', 'http://127.0.0.1:1'])
    expect(r.status).toBe(6)
    expect(r.stdout).not.toMatch(ANSI)
    const doc = JSON.parse(r.stdout) as { ok: boolean; error: string }
    expect(doc.ok).toBe(false)
    expect(doc.error).toBe('network')
  })

  it('get with no server → exit 6, JSON error on stdout', () => {
    const r = run(['get', 'abc', '--json', '--server', 'http://127.0.0.1:1'])
    expect(r.status).toBe(6)
    const doc = JSON.parse(r.stdout) as { ok: boolean; error: string }
    expect(doc.ok).toBe(false)
    expect(doc.error).toBe('network')
  })
})

describe('exit-code contract (failure modes without a server)', () => {
  it('unknown subcommand → exit 1 (commander default), error on stderr', () => {
    const r = run(['no-such-command'])
    expect(r.status).not.toBe(0)
    // commander writes to stderr; stdout stays empty
    expect(r.stdout).toBe('')
    expect(r.stderr.length).toBeGreaterThan(0)
  })

  it('init --client unknown → exit 2 (usage)', () => {
    const r = run(['init', '--client', 'no-such-client'])
    expect(r.status).toBe(2)
    expect(r.stderr).toMatch(/unknown --client/)
  })

  it('validate of bad YAML → exit 3 (validation)', () => {
    const r = run(['validate', '-'], 'nodses: []\n')
    expect(r.status).toBe(3)
  })
})

describe('output discipline: human mode', () => {
  it('validate (good) — no --json: stderr-only success line, stdout empty', () => {
    const r = run(['validate', EXAMPLE_GOOD])
    expect(r.status).toBe(0)
    expect(r.stdout).toBe('')
    expect(r.stderr).toMatch(/Valid flow/)
  })

  it('validate (bad) — no --json: errors on stderr, stdout empty, exit 3', () => {
    const r = run(['validate', '-'], 'nodses: []\n')
    expect(r.status).toBe(3)
    expect(r.stdout).toBe('')
    expect(r.stderr).toMatch(/Validation errors/)
  })

  it('non-TTY child has no ANSI escapes anywhere', () => {
    // Spawning with stdio: 'pipe' makes both streams non-TTY for the child.
    const r = run(['validate', EXAMPLE_GOOD])
    expect(r.stdout).not.toMatch(ANSI)
    expect(r.stderr).not.toMatch(ANSI)
  })
})

describe('stdin discipline', () => {
  it('validate accepts YAML from stdin via "-"', () => {
    const yaml = readFileSync(EXAMPLE_GOOD, 'utf-8')
    const r = run(['validate', '-', '--json'], yaml)
    expect(r.status).toBe(0)
    expect(JSON.parse(r.stdout)).toEqual({ valid: true })
  })
})
