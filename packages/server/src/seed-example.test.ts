import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FlowStore } from './store.js'
import { syncExampleOrderFlow } from './seed-example.js'

test('syncExampleOrderFlow updates an existing example flow from examples/order-flow.yaml', async () => {
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

  assert.equal(result, 'updated')
  assert.ok(updated)
  assert.equal(updated.meta.title, 'Create Order')
  assert.ok(updated.flow.nodes.some((node) => node.id === 'authz'))
  assert.ok(updated.flow.nodes.some((node) => node.id === 'rate-limit'))
})
