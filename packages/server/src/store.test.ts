import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FlowStore } from './store.js'
import { InvalidFlowIdError } from './flow-id.js'

describe('FlowStore path safety', () => {
  let dir: string
  let store: FlowStore

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'openhop-store-test-'))
    await writeFile(
      join(dir, 'outside.yaml'),
      'id: outside\nversion: 1\ncreatedAt: "2026-01-01T00:00:00.000Z"\nupdatedAt: "2026-01-01T00:00:00.000Z"\nroot:\n  meta:\n    title: Outside\n  flow:\n    nodes:\n      - id: a\n        label: A\n',
      'utf-8'
    )
    store = new FlowStore(join(dir, 'flows'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('does not read files outside the flow directory', async () => {
    await expect(store.get('../outside')).rejects.toBeInstanceOf(InvalidFlowIdError)
  })

  it('does not delete files outside the flow directory', async () => {
    await expect(store.delete('../outside')).rejects.toBeInstanceOf(InvalidFlowIdError)
    const content = await readFile(join(dir, 'outside.yaml'), 'utf-8')
    expect(content).toContain('Outside')
  })
})
