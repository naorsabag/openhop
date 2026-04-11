import { join } from 'node:path'
import { homedir } from 'node:os'
import { mkdir, readFile, writeFile, readdir, unlink } from 'node:fs/promises'
import YAML from 'yaml'
import type { Root } from '@flowscope/shared'

export interface StoredFlow {
  id: string
  flow: Root
  version: number
  createdAt: string
  updatedAt: string
}

interface StoredFlowFile {
  id: string
  version: number
  createdAt: string
  updatedAt: string
  flow: Root
}

export class FlowStore {
  private initialized = false

  constructor(private dir: string = join(homedir(), '.flowscope', 'flows')) {}

  private async ensureDir(): Promise<void> {
    if (this.initialized) return
    await mkdir(this.dir, { recursive: true })
    this.initialized = true
  }

  private filePath(id: string): string {
    return join(this.dir, `${id}.yaml`)
  }

  async save(id: string, flow: Root): Promise<StoredFlow> {
    await this.ensureDir()
    const now = new Date().toISOString()
    const stored: StoredFlowFile = {
      id,
      version: 1,
      createdAt: now,
      updatedAt: now,
      flow,
    }
    await writeFile(this.filePath(id), YAML.stringify(stored), 'utf-8')
    return {
      id: stored.id,
      flow: stored.flow,
      version: stored.version,
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
    }
  }

  async get(id: string): Promise<StoredFlow | null> {
    await this.ensureDir()
    try {
      const content = await readFile(this.filePath(id), 'utf-8')
      const stored = YAML.parse(content) as StoredFlowFile
      return {
        id: stored.id,
        flow: stored.flow,
        version: stored.version,
        createdAt: stored.createdAt,
        updatedAt: stored.updatedAt,
      }
    } catch {
      return null
    }
  }

  async list(): Promise<StoredFlow[]> {
    await this.ensureDir()
    const files = await readdir(this.dir)
    const yamlFiles = files.filter((f) => f.endsWith('.yaml'))
    const results: StoredFlow[] = []
    for (const file of yamlFiles) {
      try {
        const content = await readFile(join(this.dir, file), 'utf-8')
        const stored = YAML.parse(content) as StoredFlowFile
        results.push({
          id: stored.id,
          flow: stored.flow,
          version: stored.version,
          createdAt: stored.createdAt,
          updatedAt: stored.updatedAt,
        })
      } catch {
        // Skip corrupt files
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

  async updateFlow(id: string, flow: Root): Promise<StoredFlow> {
    await this.ensureDir()
    const existing = await this.get(id)
    if (!existing) {
      throw new Error(`Flow "${id}" not found`)
    }
    const now = new Date().toISOString()
    const stored: StoredFlowFile = {
      id,
      version: existing.version + 1,
      createdAt: existing.createdAt,
      updatedAt: now,
      flow,
    }
    await writeFile(this.filePath(id), YAML.stringify(stored), 'utf-8')
    return {
      id: stored.id,
      flow: stored.flow,
      version: stored.version,
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
    }
  }
}
