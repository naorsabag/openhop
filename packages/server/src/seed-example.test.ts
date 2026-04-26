import { describe, it, expect } from 'vitest'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FlowStore } from './store.js'
import { syncExampleOrderFlow } from './seed-example.js'

describe('syncExampleOrderFlow', () => {
  it('updates an existing example flow from examples/order-flow.yaml', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'openhop-example-flow-'))
    const store = new FlowStore(dir)

    await store.save('example-order-flow', {
      meta: {
        title: 'Old Example',
      },
      flow: {
        nodes: [{ id: 'old-node', label: 'Old Node' }],
        steps: [],
      },
    })

    const result = await syncExampleOrderFlow(store)
    const updated = await store.get('example-order-flow')

    expect(result).toBe('updated')
    expect(updated).toBeDefined()
    expect(updated!.meta.title).toBe('Create Order')
    expect(updated!.flow.nodes.some((node) => node.id === 'authz')).toBe(true)
    expect(updated!.flow.nodes.some((node) => node.id === 'rate-limit')).toBe(true)
  })
})
