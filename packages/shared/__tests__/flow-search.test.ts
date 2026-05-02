import { describe, expect, it } from 'vitest'
import { searchFlows, buildFlowTree, levenshtein } from '../src/flow-search.js'

const flows = [
  { id: 'a1', title: 'Order Processing', path: 'e-commerce/orders', description: 'Place an order' },
  { id: 'a2', title: 'Order Refunds', path: 'e-commerce/orders' },
  { id: 'a3', title: 'Auth Flow', path: 'platform/auth' },
  { id: 'a4', title: 'Demo', path: null, description: 'no path on this one' },
]

describe('searchFlows', () => {
  it('returns all flows in input order for an empty query', () => {
    const out = searchFlows(flows, '')
    expect(out.map((r) => r.flow.id)).toEqual(['a1', 'a2', 'a3', 'a4'])
  })

  it('ranks exact title matches highest', () => {
    const out = searchFlows(flows, 'Auth Flow')
    expect(out[0].flow.id).toBe('a3')
    expect(out[0].score).toBe(1000)
  })

  it('finds substring matches across title, path, and description', () => {
    const titleHit = searchFlows(flows, 'order')
    expect(titleHit.map((r) => r.flow.id)).toContain('a1')
    expect(titleHit.map((r) => r.flow.id)).toContain('a2')

    const pathHit = searchFlows(flows, 'platform')
    expect(pathHit[0].flow.id).toBe('a3')
    expect(pathHit[0].matched).toBe('path')

    const descHit = searchFlows(flows, 'no path on')
    expect(descHit[0].flow.id).toBe('a4')
    expect(descHit[0].matched).toBe('description')
  })

  it('tolerates small typos via fuzzy matching', () => {
    const out = searchFlows(flows, 'oder') // typo of "order"
    expect(out.map((r) => r.flow.id)).toContain('a1')
  })

  it('drops results that fall outside the fuzzy tolerance', () => {
    const out = searchFlows(flows, 'completelyunrelated')
    expect(out).toEqual([])
  })

  it('prefix match outranks substring match', () => {
    // "Order" in "Order Processing" is a prefix → 800+
    // "order" in "e-commerce/orders" is substring → 500+
    const out = searchFlows(flows, 'order')
    // a1 matched as title prefix; a2 also title prefix.
    // The first two should both be title-prefix and score >= 800.
    expect(out[0].score).toBeGreaterThanOrEqual(800)
    expect(out[1].score).toBeGreaterThanOrEqual(800)
  })
})

describe('buildFlowTree', () => {
  it('groups flows by their meta.path segments', () => {
    const root = buildFlowTree(flows)
    const ecommerce = root.folders.find((f) => f.name === 'e-commerce')
    expect(ecommerce).toBeTruthy()
    const orders = ecommerce!.folders.find((f) => f.name === 'orders')
    expect(orders!.flows.map((f) => f.id).sort()).toEqual(['a1', 'a2'])
  })

  it('sorts folders and flows alphabetically', () => {
    const root = buildFlowTree(flows)
    expect(root.folders.map((f) => f.name)).toEqual(['(no path)', 'e-commerce', 'platform'])
  })

  it('puts unpathed flows under a synthetic (no path) folder', () => {
    const root = buildFlowTree(flows)
    const unpathed = root.folders.find((f) => f.name === '(no path)')
    expect(unpathed!.flows.map((f) => f.id)).toEqual(['a4'])
  })
})

describe('levenshtein', () => {
  it('is 0 for identical strings', () => {
    expect(levenshtein('abc', 'abc')).toBe(0)
  })

  it('counts single-char substitutions, insertions, and deletions', () => {
    expect(levenshtein('cat', 'bat')).toBe(1) // sub
    expect(levenshtein('cat', 'cats')).toBe(1) // insert
    expect(levenshtein('cats', 'cat')).toBe(1) // delete
  })

  it('handles empty strings', () => {
    expect(levenshtein('', 'abc')).toBe(3)
    expect(levenshtein('abc', '')).toBe(3)
    expect(levenshtein('', '')).toBe(0)
  })
})
