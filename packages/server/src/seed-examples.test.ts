import { describe, it, expect } from 'vitest'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FlowStore } from './store.js'
import { seedBundledExamples } from './seed-examples.js'

describe('seedBundledExamples', () => {
  it('seeds every example + showcase YAML on an empty store', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'openhop-seed-fresh-'))
    const store = new FlowStore(dir)

    const result = await seedBundledExamples(store)

    // Every YAML in examples/ + examples/showcase/ should land as a new flow.
    // We don't pin an exact count (it'll change as examples are added) — just
    // assert "more than the previous one-shot seed" and that known anchors
    // (order-flow, langgraph, ai-browsing-agent) are present.
    expect(result.created.length).toBeGreaterThan(5)
    expect(result.updated.length).toBe(0)
    expect(result.failed.length).toBe(0)
    expect(result.created).toContain('example-order-flow')
    expect(result.created).toContain('example-langgraph')
    expect(result.created).toContain('example-ai-browsing-agent')
  })

  it('updates an existing example in place on the second run', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'openhop-seed-rerun-'))
    const store = new FlowStore(dir)

    // Plant a stale version of one seeded flow so the second-pass branch
    // (existing → update) is exercised.
    await store.save('example-order-flow', {
      meta: { title: 'Old Example' },
      flow: {
        nodes: [{ id: 'old-node', label: 'Old Node' }],
        steps: [],
      },
    })

    const result = await seedBundledExamples(store)
    const refreshed = await store.get('example-order-flow')

    expect(result.updated).toContain('example-order-flow')
    expect(refreshed!.meta.title).toBe('Create Order')
    expect(refreshed!.flow.nodes.some((n) => n.id === 'authz')).toBe(true)
  })
})
