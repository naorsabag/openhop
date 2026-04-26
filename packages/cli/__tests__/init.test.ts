/**
 * Unit tests for `openhop init`. Exercises the pure planner (`runInit`)
 * with a mock fs surface — no real disk writes, no subprocesses.
 *
 * Note: the deliverable spec asked for src/init.test.ts, but vitest is
 * configured to only collect tests under __tests__/ (see vitest.config.ts).
 * Keeping the file here so the suite actually runs. The constraint forbade
 * editing utils/server/index.ts but not vitest.config.ts; placing here is
 * the smaller change.
 */

import { describe, it, expect } from 'vitest'
import {
  buildClients,
  runInit,
  renderTable,
  type ClientSpec,
  type FsLike,
} from '../src/init.js'

/** Build an in-memory fs-like surface for tests. */
function makeFs(initial: { dirs?: string[]; files?: string[] } = {}): FsLike & {
  writes: Array<{ src: string; dest: string }>
  mkdirs: string[]
} {
  const dirs = new Set<string>(initial.dirs ?? [])
  const files = new Set<string>(initial.files ?? [])
  const writes: Array<{ src: string; dest: string }> = []
  const mkdirs: string[] = []
  return {
    writes,
    mkdirs,
    existsSync: (p: string) => dirs.has(p) || files.has(p),
    statSync: (p: string) => ({ isDirectory: () => dirs.has(p) }),
    cpSync: (src, dest) => {
      writes.push({ src, dest })
      dirs.add(dest)
    },
    mkdirSync: (p) => {
      mkdirs.push(p)
      dirs.add(p)
    },
  }
}

const HOME = '/home/u'
const SOURCE = '/repo/skills/openhop'

describe('buildClients', () => {
  it('produces stable ids for each supported client', () => {
    const ids = buildClients(HOME, 'linux').map((c) => c.id)
    expect(ids).toEqual(['claude-code', 'cursor', 'windsurf', 'cline', 'continue'])
  })

  it('points claude-code at ~/.claude/skills', () => {
    const cc = buildClients(HOME).find((c) => c.id === 'claude-code')!
    expect(cc.detectDir()).toBe('/home/u/.claude')
    expect(cc.skillsDir()).toBe('/home/u/.claude/skills')
  })
})

describe('runInit — detection', () => {
  it('skips clients whose config dir is missing', () => {
    const fs = makeFs({ dirs: [SOURCE] }) // no client dirs present
    const { results } = runInit({}, buildClients(HOME), SOURCE, fs)
    expect(results.every((r) => r.status === 'skipped')).toBe(true)
    expect(results[0]).toMatchObject({ client: 'claude-code', reason: 'not detected' })
    expect(fs.writes).toHaveLength(0)
  })

  it('marks source-missing when bundled skill cannot be found', () => {
    const fs = makeFs()
    const { results, sourceMissing } = runInit({}, buildClients(HOME), null, fs)
    expect(sourceMissing).toBe(true)
    expect(results).toEqual([])
  })
})

describe('runInit — install behavior', () => {
  const detectedHome: string[] = [`${HOME}/.claude`]

  it('installs into a detected client when destination is empty', () => {
    const fs = makeFs({ dirs: [SOURCE, ...detectedHome] })
    const { results } = runInit({}, buildClients(HOME), SOURCE, fs)
    const cc = results.find((r) => r.client === 'claude-code')!
    expect(cc.status).toBe('installed')
    expect(cc.path).toBe(`${HOME}/.claude/skills/openhop`)
    expect(fs.writes).toContainEqual({ src: SOURCE, dest: `${HOME}/.claude/skills/openhop` })
    expect(fs.mkdirs).toContain(`${HOME}/.claude/skills`)
  })

  it('--dry-run does not write anything', () => {
    const fs = makeFs({ dirs: [SOURCE, ...detectedHome] })
    const { results } = runInit({ dryRun: true }, buildClients(HOME), SOURCE, fs)
    const cc = results.find((r) => r.client === 'claude-code')!
    expect(cc.status).toBe('would-install')
    expect(fs.writes).toHaveLength(0)
    expect(fs.mkdirs).toHaveLength(0)
  })

  it('skips when destination already exists and --force is not set', () => {
    const dest = `${HOME}/.claude/skills/openhop`
    const fs = makeFs({ dirs: [SOURCE, ...detectedHome, dest] })
    const { results } = runInit({}, buildClients(HOME), SOURCE, fs)
    const cc = results.find((r) => r.client === 'claude-code')!
    expect(cc.status).toBe('skipped')
    expect(cc.reason).toMatch(/already installed/)
    expect(fs.writes).toHaveLength(0)
  })

  it('overwrites when --force is set', () => {
    const dest = `${HOME}/.claude/skills/openhop`
    const fs = makeFs({ dirs: [SOURCE, ...detectedHome, dest] })
    const { results } = runInit({ force: true }, buildClients(HOME), SOURCE, fs)
    const cc = results.find((r) => r.client === 'claude-code')!
    expect(cc.status).toBe('installed')
    expect(fs.writes).toHaveLength(1)
  })
})

describe('runInit — --client filter', () => {
  it('targets a single client when --client is provided', () => {
    const fs = makeFs({ dirs: [SOURCE, `${HOME}/.claude`, `${HOME}/.cursor`] })
    const { results } = runInit({ client: 'claude-code' }, buildClients(HOME), SOURCE, fs)
    expect(results).toHaveLength(1)
    expect(results[0].client).toBe('claude-code')
  })

  it('produces empty results when --client matches no known client', () => {
    const fs = makeFs({ dirs: [SOURCE, `${HOME}/.claude`] })
    const { results } = runInit({ client: 'no-such-client' }, buildClients(HOME), SOURCE, fs)
    expect(results).toEqual([])
  })
})

describe('runInit — advisory clients', () => {
  it('marks advisory clients without writing', () => {
    const fs = makeFs({ dirs: [SOURCE, `${HOME}/.continue`] })
    const { results } = runInit({ client: 'continue' }, buildClients(HOME), SOURCE, fs)
    expect(results[0].status).toBe('advisory')
    expect(fs.writes).toHaveLength(0)
  })
})

describe('renderTable', () => {
  it('renders a header + rows with consistent column padding', () => {
    const out = renderTable([
      { client: 'claude-code', status: 'installed', path: '/x' },
      { client: 'cursor', status: 'skipped', reason: 'not detected' },
    ])
    const lines = out.split('\n')
    expect(lines[0]).toMatch(/Client/)
    expect(lines[0]).toMatch(/Status/)
    expect(lines[0]).toMatch(/Path/)
    expect(lines).toHaveLength(4) // header + sep + 2 rows
    expect(lines[2]).toMatch(/claude-code/)
    expect(lines[2]).toMatch(/installed/)
  })
})

describe('JSON summary shape', () => {
  // We don't drive the CLI subprocess here (it calls process.exit). Instead
  // we assert that runInit's result vector maps cleanly into the documented
  // JSON shape, which is the only contract callers depend on.
  it('partitions results into installed/skipped/failed buckets', () => {
    const dest = `${HOME}/.claude/skills/openhop`
    const fs = makeFs({
      dirs: [SOURCE, `${HOME}/.claude`, `${HOME}/.cursor`, dest],
    })
    const { results } = runInit({}, buildClients(HOME), SOURCE, fs)
    const installed = results.filter((r) => r.status === 'installed')
    const skipped = results.filter((r) => r.status === 'skipped' || r.status === 'advisory')
    const failed = results.filter((r) => r.status === 'failed')
    // claude-code dest exists → skipped; cursor → installed; advisories → skipped
    expect(installed.map((r) => r.client)).toContain('cursor')
    expect(skipped.map((r) => r.client)).toContain('claude-code')
    expect(failed).toEqual([])
  })
})

describe('ClientSpec type sanity', () => {
  it('exposes detect+skills directories as functions', () => {
    const c: ClientSpec = buildClients(HOME)[0]
    expect(typeof c.detectDir).toBe('function')
    expect(typeof c.skillsDir).toBe('function')
  })
})
