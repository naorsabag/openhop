import { join } from 'node:path'
import { homedir } from 'node:os'
import { mkdir, readFile, writeFile, readdir, unlink } from 'node:fs/promises'
import YAML from 'yaml'
import type { Root } from '@openhop/shared'

export interface StoredFlow {
  id: string
  meta: Root['meta']
  flow: Root['flow']
  version: number
  createdAt: string
  updatedAt: string
}

interface StoredFlowFile {
  id: string
  version: number
  createdAt: string
  updatedAt: string
  root: Root // the full Root object on disk
}

/**
 * Resolve the default storage directory. Order:
 *   1. Constructor `dir` arg (explicit override, used by tests)
 *   2. `OPENHOP_DATA_DIR` env var (per-process / per-deployment override)
 *   3. `<homedir>/.openhop/flows` (cross-OS default — Linux:
 *      `/home/<user>/`, macOS: `/Users/<user>/`, Windows:
 *      `C:\Users\<user>\`).
 *
 * Flows persist across server restarts: the same user account on the
 * same machine always sees the same flow set, even after `npx openhop
 * demo` / `serve` is killed and re-run. Set `OPENHOP_DATA_DIR=...` to
 * isolate (e.g. ephemeral demo, per-project workspace, CI fixture).
 */
function defaultDataDir(): string {
  return process.env.OPENHOP_DATA_DIR || join(homedir(), '.openhop', 'flows')
}

export class FlowStore {
  private initialized = false

  constructor(private dir: string = defaultDataDir()) {}

  private async ensureDir(): Promise<void> {
    if (this.initialized) return
    await mkdir(this.dir, { recursive: true })
    this.initialized = true
  }

  private filePath(id: string): string {
    return join(this.dir, `${id}.yaml`)
  }

  private toStoredFlow(file: StoredFlowFile): StoredFlow {
    return {
      id: file.id,
      meta: file.root.meta,
      flow: file.root.flow,
      version: file.version,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    }
  }

  async save(id: string, root: Root): Promise<StoredFlow> {
    await this.ensureDir()
    const now = new Date().toISOString()
    const file: StoredFlowFile = { id, version: 1, createdAt: now, updatedAt: now, root }
    await writeFile(this.filePath(id), YAML.stringify(file), 'utf-8')
    return this.toStoredFlow(file)
  }

  async get(id: string): Promise<StoredFlow | null> {
    await this.ensureDir()
    try {
      const content = await readFile(this.filePath(id), 'utf-8')
      const file = YAML.parse(content) as StoredFlowFile
      return this.toStoredFlow(file)
    } catch {
      return null
    }
  }

  async list(): Promise<StoredFlow[]> {
    await this.ensureDir()
    const files = await readdir(this.dir)
    const results: StoredFlow[] = []
    for (const f of files.filter((f) => f.endsWith('.yaml'))) {
      try {
        const content = await readFile(join(this.dir, f), 'utf-8')
        const file = YAML.parse(content) as StoredFlowFile
        results.push(this.toStoredFlow(file))
      } catch {
        /* skip corrupt */
      }
    }
    return results
  }

  async delete(id: string): Promise<boolean> {
    await this.ensureDir()
    try {
      await unlink(this.filePath(id))
      return true
    } catch {
      return false
    }
  }

  async getVersion(id: string): Promise<number | null> {
    const stored = await this.get(id)
    return stored ? stored.version : null
  }

  async updateFlow(id: string, root: Root): Promise<StoredFlow> {
    await this.ensureDir()
    const existing = await this.get(id)
    if (!existing) {
      throw new Error(`Flow "${id}" not found`)
    }
    const now = new Date().toISOString()
    const file: StoredFlowFile = {
      id,
      version: existing.version + 1,
      createdAt: existing.createdAt,
      updatedAt: now,
      root,
    }
    await writeFile(this.filePath(id), YAML.stringify(file), 'utf-8')
    return this.toStoredFlow(file)
  }
}
