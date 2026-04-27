import { describe, it, expect } from 'vitest'
import { applyPatch, patchSchema } from '../src/patch'
import type { Root } from '../src/schema'

// --- Helpers ---

function makeRoot(overrides?: Partial<Root>): Root {
  return {
    meta: { title: 'Test Flow' },
    flow: {
      nodes: [
        { id: 'a', label: 'Node A' },
        { id: 'b', label: 'Node B' },
      ],
      steps: [{ from: 'a', to: 'b', data: 'request' }],
    },
    ...overrides,
  } as Root
}

describe('patchSchema validation', () => {
  it('rejects empty operations array', () => {
    const result = patchSchema.safeParse({ operations: [] })
    expect(result.success).toBe(false)
  })

  it('rejects unknown operation type', () => {
    const result = patchSchema.safeParse({
      operations: [{ op: 'unknown-op' }],
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid operations', () => {
    const result = patchSchema.safeParse({
      operations: [
        { op: 'add-nodes', nodes: [{ id: 'c', label: 'Node C' }] },
        { op: 'rename-nodes', nodes: [{ id: 'a', label: 'New A' }] },
      ],
    })
    expect(result.success).toBe(true)
  })
})

describe('applyPatch', () => {
  describe('add-nodes', () => {
    it('adds a new node to the flow', () => {
      const root = makeRoot()
      const result = applyPatch(root, {
        operations: [{ op: 'add-nodes', nodes: [{ id: 'c', label: 'Node C', type: 'cache' }] }],
      })
      expect(result.success).toBe(true)
      expect(result.data!.flow.nodes).toHaveLength(3)
      expect(result.data!.flow.nodes[2]).toMatchObject({
        id: 'c',
        label: 'Node C',
      })
    })

    it('returns error for duplicate node ID', () => {
      const root = makeRoot()
      const result = applyPatch(root, {
        operations: [{ op: 'add-nodes', nodes: [{ id: 'a', label: 'Duplicate' }] }],
      })
      expect(result.success).toBe(false)
      expect(result.errors[0].message).toContain('already exists')
    })
  })

  describe('remove-nodes', () => {
    it('removes a node and its referencing steps', () => {
      const root = makeRoot()
      const result = applyPatch(root, {
        operations: [{ op: 'remove-nodes', nodes: ['b'] }],
      })
      expect(result.success).toBe(true)
      expect(result.data!.flow.nodes).toHaveLength(1)
      expect(result.data!.flow.nodes[0].id).toBe('a')
      // The step from a->b should be removed since it references "b"
      expect(result.data!.flow.steps ?? []).toHaveLength(0)
    })

    it('returns error for nonexistent node', () => {
      const root = makeRoot()
      const result = applyPatch(root, {
        operations: [{ op: 'remove-nodes', nodes: ['nonexistent'] }],
      })
      expect(result.success).toBe(false)
      expect(result.errors[0].message).toContain('not found')
    })
  })

  describe('rename-nodes', () => {
    it('renames an existing node', () => {
      const root = makeRoot()
      const result = applyPatch(root, {
        operations: [{ op: 'rename-nodes', nodes: [{ id: 'a', label: 'Renamed A' }] }],
      })
      expect(result.success).toBe(true)
      expect(result.data!.flow.nodes[0].label).toBe('Renamed A')
    })

    it('returns error for nonexistent node', () => {
      const root = makeRoot()
      const result = applyPatch(root, {
        operations: [{ op: 'rename-nodes', nodes: [{ id: 'missing', label: 'X' }] }],
      })
      expect(result.success).toBe(false)
      expect(result.errors[0].message).toContain('not found')
    })
  })

  describe('update-nodes', () => {
    it('updates node type, icon, and color', () => {
      const root = makeRoot()
      const result = applyPatch(root, {
        operations: [
          {
            op: 'update-nodes',
            nodes: [{ id: 'a', type: 'database', icon: 'db-icon', color: '#00ff00' }],
          },
        ],
      })
      expect(result.success).toBe(true)
      const node = result.data!.flow.nodes.find((n) => n.id === 'a')
      expect(node!.type).toBe('database')
      expect(node!.icon).toBe('db-icon')
      expect(node!.color).toBe('#00ff00')
    })

    it('returns error for nonexistent node', () => {
      const root = makeRoot()
      const result = applyPatch(root, {
        operations: [{ op: 'update-nodes', nodes: [{ id: 'missing', type: 'cache' }] }],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('set-flows', () => {
    it('sets a sub-flow on a node', () => {
      const root = makeRoot()
      const result = applyPatch(root, {
        operations: [
          {
            op: 'set-flows',
            nodes: [
              {
                id: 'a',
                flow: {
                  nodes: [
                    { id: 'x', label: 'Sub X' },
                    { id: 'y', label: 'Sub Y' },
                  ],
                  steps: [{ from: 'x', to: 'y', data: 'inner' }],
                },
              },
            ],
          },
        ],
      })
      expect(result.success).toBe(true)
      const nodeA = result.data!.flow.nodes.find((n) => n.id === 'a')
      expect(nodeA!.flow).toBeDefined()
      expect(nodeA!.flow!.nodes).toHaveLength(2)
    })

    it('returns error for nonexistent node', () => {
      const root = makeRoot()
      const result = applyPatch(root, {
        operations: [
          {
            op: 'set-flows',
            nodes: [{ id: 'missing', flow: { nodes: [{ id: 'x', label: 'X' }] } }],
          },
        ],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('clear-flows', () => {
    it('removes a sub-flow from a node', () => {
      const root: Root = {
        meta: { title: 'Test' },
        flow: {
          nodes: [
            {
              id: 'a',
              label: 'A',
              flow: {
                nodes: [{ id: 'x', label: 'X' }],
              },
            },
            { id: 'b', label: 'B' },
          ],
          steps: [{ from: 'a', to: 'b', data: 'msg' }],
        },
      } as Root

      const result = applyPatch(root, {
        operations: [{ op: 'clear-flows', nodes: ['a'] }],
      })
      expect(result.success).toBe(true)
      const nodeA = result.data!.flow.nodes.find((n) => n.id === 'a')
      expect(nodeA!.flow).toBeUndefined()
    })

    it('returns error for nonexistent node', () => {
      const root = makeRoot()
      const result = applyPatch(root, {
        operations: [{ op: 'clear-flows', nodes: ['missing'] }],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('add-steps', () => {
    it('inserts at the beginning (index: 0)', () => {
      const root = makeRoot()
      const result = applyPatch(root, {
        operations: [
          {
            op: 'add-steps',
            index: 0,
            steps: [{ from: 'b', to: 'a', data: 'response' }],
          },
        ],
      })
      expect(result.success).toBe(true)
      expect(result.data!.flow.steps).toHaveLength(2)
      expect(result.data!.flow.steps![0]).toMatchObject({
        from: 'b',
        to: 'a',
        data: 'response',
      })
    })

    it('inserts at a middle index (existing step gets pushed right)', () => {
      // makeRoot has 1 step (a→b). Insert at index 1 → becomes the 2nd step,
      // existing step stays at index 0.
      const root = makeRoot()
      const result = applyPatch(root, {
        operations: [
          {
            op: 'add-steps',
            index: 1,
            steps: [{ from: 'b', to: 'a', data: 'response' }],
          },
        ],
      })
      expect(result.success).toBe(true)
      expect(result.data!.flow.steps).toHaveLength(2)
      expect(result.data!.flow.steps![1]).toMatchObject({
        from: 'b',
        to: 'a',
      })
    })
  })

  describe('remove-steps', () => {
    it('removes a step by index', () => {
      const root = makeRoot()
      const result = applyPatch(root, {
        operations: [{ op: 'remove-steps', indices: [0] }],
      })
      expect(result.success).toBe(true)
      expect(result.data!.flow.steps ?? []).toHaveLength(0)
    })

    it('returns error for out-of-range index', () => {
      const root = makeRoot()
      const result = applyPatch(root, {
        operations: [{ op: 'remove-steps', indices: [99] }],
      })
      expect(result.success).toBe(false)
      expect(result.errors[0].message).toContain('out of range')
    })
  })

  describe('update-step', () => {
    it('replaces a step by index', () => {
      const root = makeRoot()
      const result = applyPatch(root, {
        operations: [
          {
            op: 'update-step',
            index: 0,
            step: { from: 'b', to: 'a', data: 'reversed' },
          },
        ],
      })
      expect(result.success).toBe(true)
      expect(result.data!.flow.steps![0]).toMatchObject({
        from: 'b',
        to: 'a',
        data: 'reversed',
      })
    })
  })

  describe('multiple operations', () => {
    it('applies multiple operations in sequence', () => {
      const root = makeRoot()
      const result = applyPatch(root, {
        operations: [
          { op: 'add-nodes', nodes: [{ id: 'c', label: 'Node C' }] },
          { op: 'rename-nodes', nodes: [{ id: 'a', label: 'Alpha' }] },
          { op: 'remove-steps', indices: [0] },
          {
            op: 'add-steps',
            index: 0,
            steps: [
              { from: 'a', to: 'c', data: 'new step' },
              { from: 'c', to: 'b', data: 'another' },
            ],
          },
        ],
      })
      expect(result.success).toBe(true)
      expect(result.data!.flow.nodes).toHaveLength(3)
      expect(result.data!.flow.nodes[0].label).toBe('Alpha')
      expect(result.data!.flow.steps).toHaveLength(2)
    })
  })

  describe('validation after patch', () => {
    it('returns validation errors for invalid resulting flow', () => {
      const root = makeRoot()
      // Add a step referencing a node that doesn't exist
      const result = applyPatch(root, {
        operations: [
          {
            op: 'add-steps',
            index: 1,
            steps: [{ from: 'a', to: 'ghost', data: 'bad' }],
          },
        ],
      })
      expect(result.success).toBe(false)
      expect(result.errors.some((e) => e.message.includes('not found'))).toBe(true)
    })
  })

  it('does not mutate the original root', () => {
    const root = makeRoot()
    const originalNodeCount = root.flow.nodes.length
    applyPatch(root, {
      operations: [{ op: 'add-nodes', nodes: [{ id: 'c', label: 'Node C' }] }],
    })
    expect(root.flow.nodes).toHaveLength(originalNodeCount)
  })

  describe('edge cases', () => {
    it('add-steps reports out-of-range insertion position', () => {
      const root = makeRoot() // 1 step → valid range is 0..1
      const result = applyPatch(root, {
        operations: [
          {
            op: 'add-steps',
            index: 99,
            steps: [{ from: 'a', to: 'b', data: 'x' }],
          },
        ],
      })
      expect(result.success).toBe(false)
      expect(result.errors[0].message).toContain('out of range')
      // Error should teach the recovery: the valid range and the
      // "omit to append" shortcut.
      expect(result.errors[0].message).toContain('omit to append')
    })

    it('add-steps appends when index is omitted (no need to know steps.length)', () => {
      const root = makeRoot()
      const initialCount = root.flow.steps?.length ?? 0
      const result = applyPatch(root, {
        operations: [
          {
            op: 'add-steps',
            steps: [
              { from: 'a', to: 'b', data: 'appended-1' },
              { from: 'b', to: 'a', data: 'appended-2' },
            ],
          },
        ],
      })
      expect(result.success).toBe(true)
      const steps = result.data!.flow.steps!
      expect(steps).toHaveLength(initialCount + 2)
      // The two new steps must be at the very end, in order.
      expect(steps[steps.length - 2]).toMatchObject({ data: 'appended-1' })
      expect(steps[steps.length - 1]).toMatchObject({ data: 'appended-2' })
    })

    it('add-steps with explicit index === steps.length also appends', () => {
      const root = makeRoot()
      const initialCount = root.flow.steps?.length ?? 0
      const result = applyPatch(root, {
        operations: [
          {
            op: 'add-steps',
            index: initialCount,
            steps: [{ from: 'a', to: 'b', data: 'appended' }],
          },
        ],
      })
      expect(result.success).toBe(true)
      const steps = result.data!.flow.steps!
      expect(steps[steps.length - 1]).toMatchObject({ data: 'appended' })
    })

    it('add-steps initializes the steps array when absent', () => {
      const root: Root = {
        meta: { title: 'No-steps Flow' },
        flow: {
          nodes: [
            { id: 'a', label: 'A' },
            { id: 'b', label: 'B' },
          ],
        },
      } as Root
      const result = applyPatch(root, {
        operations: [
          {
            op: 'add-steps',
            // Omit index → append to a freshly-created empty array.
            steps: [{ from: 'a', to: 'b', data: 'first' }],
          },
        ],
      })
      expect(result.success).toBe(true)
      expect(result.data!.flow.steps).toHaveLength(1)
    })

    it('remove-steps reports when there are no steps to remove', () => {
      const root: Root = {
        meta: { title: 'No-steps Flow' },
        flow: { nodes: [{ id: 'a', label: 'A' }] },
      } as Root
      const result = applyPatch(root, {
        operations: [{ op: 'remove-steps', indices: [0] }],
      })
      expect(result.success).toBe(false)
      expect(result.errors[0].message).toContain('No steps')
    })

    it('update-step reports out-of-range when there are no steps', () => {
      const root: Root = {
        meta: { title: 'No-steps Flow' },
        flow: { nodes: [{ id: 'a', label: 'A' }] },
      } as Root
      const result = applyPatch(root, {
        operations: [{ op: 'update-step', index: 0, step: { from: 'a', to: 'a', data: 'x' } }],
      })
      expect(result.success).toBe(false)
      expect(result.errors[0].message).toContain('out of range')
    })

    it('remove-nodes drops parallel-step references to the removed node', () => {
      const root: Root = {
        meta: { title: 'Parallel Flow' },
        flow: {
          nodes: [
            { id: 'a', label: 'A' },
            { id: 'b', label: 'B' },
            { id: 'c', label: 'C' },
          ],
          steps: [
            {
              parallel: [
                { from: 'a', to: 'b', data: 'x' },
                { from: 'a', to: 'c', data: 'y' },
              ],
            },
          ],
        },
      } as Root
      const result = applyPatch(root, {
        operations: [{ op: 'remove-nodes', nodes: ['b'] }],
      })
      // The parallel step references 'b', so it should be dropped.
      expect(result.success).toBe(true)
      expect(result.data!.flow.steps ?? []).toHaveLength(0)
    })

    it('remove-nodes drops broadcast steps that target the removed node', () => {
      const root: Root = {
        meta: { title: 'Broadcast Flow' },
        flow: {
          nodes: [
            { id: 'a', label: 'A' },
            { id: 'b', label: 'B' },
            { id: 'c', label: 'C' },
          ],
          steps: [{ from: 'a', to: ['b', 'c'], data: 'broadcast' }],
        },
      } as Root
      const result = applyPatch(root, {
        operations: [{ op: 'remove-nodes', nodes: ['b'] }],
      })
      expect(result.success).toBe(true)
      // Broadcast referenced 'b' so the step is removed entirely.
      expect(result.data!.flow.steps ?? []).toHaveLength(0)
    })

    it('returns post-patch validation errors when the patched flow is invalid', () => {
      const root = makeRoot()
      const result = applyPatch(root, {
        operations: [
          { op: 'remove-nodes', nodes: ['b'] },
          // Now adds a step referencing the removed 'b'
          {
            op: 'add-steps',
            index: 0,
            steps: [{ from: 'a', to: 'b', data: 'orphan' }],
          },
        ],
      })
      expect(result.success).toBe(false)
      // Either operation-time error or post-validation error counts.
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })
})
