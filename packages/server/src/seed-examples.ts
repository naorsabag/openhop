import { readdir, readFile, stat } from 'node:fs/promises'
import { join, dirname, basename, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFlowYaml, type Root } from '@openhop/shared'
import { FlowStore } from './store.js'

/**
 * On startup, seed every bundled example flow into the disk-backed store.
 *
 * Examples ship in two places:
 *   - `examples/` at the repo root (in dev) or `<pkg>/examples/` (when
 *     installed from npm — the prepack script copies them in).
 *   - `examples/showcase/` (same, for the case-study flows).
 *
 * Each YAML file is loaded with a stable id `example-<basename>` so:
 *   - Repeat runs find the existing flow and update it in place (no
 *     dupes on every server restart).
 *   - Users who edit a seeded flow lose that edit the next time the
 *     server boots — that's intentional; seeded flows are read-only
 *     defaults, like a factory reset. The CLI's `push` route assigns
 *     random nanoids, so user-authored flows never collide.
 */

const EXAMPLE_DIRS = ['examples', join('examples', 'showcase')]

interface ExampleFlow {
  id: string
  data: Root
}

/** Find the directory that contains the bundled examples. We probe a few
 *  candidates so the same code works in dev (workspace root) and in a
 *  published install (`<install>/examples/`). First hit wins. */
async function findExamplesRoot(): Promise<string | null> {
  const here = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    // Workspace dev: packages/server/src/seed-examples.ts → workspace root
    join(here, '..', '..', '..'),
    // Built workspace dev: packages/server/dist/server.js → workspace root
    join(here, '..', '..'),
    // Published npm: node_modules/@openhop/server/dist/server.js → @openhop/server/
    join(here, '..'),
    // CWD fallback for tooling that copies examples into the run dir.
    process.cwd(),
  ]
  for (const dir of candidates) {
    try {
      const examplesDir = join(dir, 'examples')
      const s = await stat(examplesDir)
      if (s.isDirectory()) return dir
    } catch {
      // try next candidate
    }
  }
  return null
}

async function listExampleYamls(root: string): Promise<string[]> {
  const out: string[] = []
  for (const rel of EXAMPLE_DIRS) {
    const dir = join(root, rel)
    let entries: string[]
    try {
      entries = await readdir(dir)
    } catch {
      continue
    }
    for (const name of entries) {
      if (extname(name) !== '.yaml') continue
      out.push(join(dir, name))
    }
  }
  return out
}

async function loadExampleFlow(path: string): Promise<ExampleFlow | null> {
  try {
    const yaml = await readFile(path, 'utf-8')
    const result = parseFlowYaml(yaml)
    if (!result.success || !result.data) return null
    const id = `example-${basename(path, '.yaml')}`
    return { id, data: result.data }
  } catch {
    return null
  }
}

export interface SeedResult {
  created: string[]
  updated: string[]
  failed: string[]
}

export async function seedBundledExamples(store: FlowStore): Promise<SeedResult> {
  const result: SeedResult = { created: [], updated: [], failed: [] }
  const root = await findExamplesRoot()
  if (!root) return result

  const paths = await listExampleYamls(root)
  for (const path of paths) {
    const flow = await loadExampleFlow(path)
    if (!flow) {
      result.failed.push(basename(path))
      continue
    }
    const existing = await store.get(flow.id)
    if (existing) {
      await store.updateFlow(flow.id, flow.data)
      result.updated.push(flow.id)
    } else {
      await store.save(flow.id, flow.data)
      result.created.push(flow.id)
    }
  }
  return result
}
