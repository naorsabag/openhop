import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { Flow } from '../src/types'
import { parseFlowYaml } from '@openhop/shared'
import {
  buildFlowTopology,
  buildReactFlowGraph,
  buildOrthogonalPath,
  bundleSharedSourcePrefixes,
  inferPortAssignmentsFromRoutes,
} from '../src/lib/flow-layout.ts'

const orderFlow = {
  flow: {
    nodes: [
      { id: 'user', label: 'User', type: 'actor' },
      { id: 'api', label: 'API Gateway', type: 'endpoint' },
      { id: 'order-service', label: 'Order Service', type: 'service' },
      { id: 'db', label: 'PostgreSQL', type: 'custom', icon: 'logos:postgresql', color: '#336791' },
      { id: 'cache', label: 'Redis', type: 'custom', icon: 'logos:redis', color: '#DC382D' },
      { id: 'payment', label: 'Stripe', type: 'custom', icon: 'logos:stripe', color: '#635BFF' },
    ],
    steps: [
      { from: 'user', to: 'api', data: { label: 'POST /orders' } },
      { from: 'api', to: 'order-service', data: { label: 'create order' } },
      { from: 'order-service', to: ['db', 'cache'], data: { label: 'persist order' } },
      {
        parallel: [
          { from: 'db', to: 'order-service', data: { label: 'order saved' } },
          { from: 'cache', to: 'order-service', data: { label: 'cache updated' } },
        ],
      },
      {
        from: 'order-service',
        to: 'payment',
        data: [{ label: 'charge request' }, { label: 'order context' }],
      },
      {
        from: 'payment',
        to: 'order-service',
        data: [{ label: 'payment result' }, { label: 'transaction details' }],
        drilldown: true,
      },
      {
        create: 'audit',
        from: 'order-service',
        node: { id: 'audit', label: 'Audit Log', type: 'transform' },
        data: { label: 'log order event' },
      },
      { destroy: 'audit' },
      { from: 'order-service', to: 'api', data: { label: 'order response' } },
      { from: 'api', to: 'user', data: { label: '201 Created' } },
    ],
  },
} as Flow

describe('buildFlowTopology', () => {
  it('keeps a shared display edge per node pair while using forward-only edges for layout', () => {
    const topology = buildFlowTopology(orderFlow)

    expect(topology.layoutEdges).toEqual([
      ['user', 'api'],
      ['api', 'order-service'],
      ['order-service', 'db'],
      ['order-service', 'cache'],
      ['order-service', 'payment'],
      ['order-service', 'audit'],
    ])

    expect(topology.displayEdges.map((edge) => [edge.source, edge.target])).toEqual([
      ['user', 'api'],
      ['api', 'order-service'],
      ['order-service', 'db'],
      ['order-service', 'cache'],
      ['order-service', 'payment'],
      ['order-service', 'audit'],
    ])
  })
})

describe('computeElkLayout', () => {
  it('routes the api to order-service edge clear of the rate-limit node in the real example', async () => {
    const yaml = readFileSync(new URL('../../../examples/order-flow.yaml', import.meta.url), 'utf8')
    const parsed = parseFlowYaml(yaml)
    expect(parsed.success).toBe(true)
    if (!parsed.success || !parsed.data) return

    const { computeElkLayout, NODE_WIDTH } = await import('../src/lib/flow-layout.ts')
    const topology = buildFlowTopology(parsed.data as Flow)
    const layout = await computeElkLayout(topology)
    const edge = topology.displayEdges.find(
      (candidate) => candidate.source === 'api' && candidate.target === 'order-service'
    )
    const route = edge ? layout.routes.get(edge.id) : null
    const blocker = layout.positions.get('rate-limit')

    expect(edge).toBeTruthy()
    expect(route).toBeTruthy()
    expect(blocker).toBeTruthy()

    const paddedBox = {
      left: blocker!.x,
      right: blocker!.x + NODE_WIDTH,
      top: blocker!.y,
      bottom: blocker!.y + 120,
    }

    const intersects = (route ?? []).some((point, index, points) => {
      if (index === 0) return false
      const prev = points[index - 1]
      if (prev.x === point.x) {
        if (point.x < paddedBox.left || point.x > paddedBox.right) return false
        const segTop = Math.min(prev.y, point.y)
        const segBottom = Math.max(prev.y, point.y)
        return segBottom > paddedBox.top && segTop < paddedBox.bottom
      }
      if (prev.y === point.y) {
        if (point.y < paddedBox.top || point.y > paddedBox.bottom) return false
        const segLeft = Math.min(prev.x, point.x)
        const segRight = Math.max(prev.x, point.x)
        return segRight > paddedBox.left && segLeft < paddedBox.right
      }
      return false
    })

    expect(intersects).toBe(false)
  })
})

describe('buildReactFlowGraph', () => {
  it('splits same-side fanout edges across different handles after layout positions are known', () => {
    const topology = buildFlowTopology(orderFlow)
    const graph = buildReactFlowGraph(
      topology,
      new Map([
        ['user', { x: 0, y: 0 }],
        ['api', { x: 220, y: 0 }],
        ['order-service', { x: 440, y: 0 }],
        ['db', { x: 700, y: -140 }],
        ['cache', { x: 700, y: 140 }],
        ['payment', { x: 920, y: 0 }],
        ['audit', { x: 700, y: 300 }],
      ])
    )

    const dbEdge = graph.edges.find(
      (edge) => edge.source === 'order-service' && edge.target === 'db'
    )
    const cacheEdge = graph.edges.find(
      (edge) => edge.source === 'order-service' && edge.target === 'cache'
    )

    expect(dbEdge?.sourceHandle).toBe('top')
    expect(cacheEdge?.sourceHandle).toBe('bottom')
    expect(dbEdge?.sourceHandle).not.toBe(cacheEdge?.sourceHandle)
  })

  it('renders self-loop edges as an ear over the top-right with right→top ports', () => {
    const selfLoopFlow = {
      flow: {
        nodes: [{ id: 'worker', label: 'Worker', type: 'service' }],
        steps: [{ from: 'worker', to: 'worker', data: { label: 'retry' } }],
      },
    } as Flow
    const topology = buildFlowTopology(selfLoopFlow)
    const graph = buildReactFlowGraph(topology, new Map([['worker', { x: 0, y: 0 }]]))

    const loopEdge = graph.edges.find(
      (edge) => edge.source === 'worker' && edge.target === 'worker'
    )

    expect(loopEdge).toBeTruthy()
    expect(loopEdge?.sourceHandle).toBe('right')
    expect(loopEdge?.targetHandle).toBe('top')
    // Ear extends above the node (negative y) and to the right of it (x > NODE_WIDTH).
    const path = (loopEdge?.data as { elkPath?: string } | undefined)?.elkPath
    expect(path).toBeDefined()
    expect(path).toMatch(/-\d/) // contains a negative coordinate (route loops above y=0)
  })

  it('keeps an explicit orthogonal path from layout routing data when provided', () => {
    const topology = buildFlowTopology(orderFlow)
    const graph = buildReactFlowGraph(
      topology,
      new Map([
        ['user', { x: 0, y: 0 }],
        ['api', { x: 220, y: 0 }],
        ['order-service', { x: 440, y: 0 }],
        ['db', { x: 700, y: -140 }],
        ['cache', { x: 700, y: 140 }],
        ['payment', { x: 920, y: 0 }],
        ['audit', { x: 700, y: 300 }],
      ]),
      new Map([
        [
          'e-5',
          [
            { x: 512, y: 72 },
            { x: 512, y: 420 },
            { x: 620, y: 420 },
            { x: 620, y: 612 },
          ],
        ],
      ])
    )

    const auditEdge = graph.edges.find((edge) => edge.id === 'e-5')

    expect(auditEdge?.data).toMatchObject({
      elkPath: 'M 512 72 L 512 420 L 620 420 L 620 612',
    })
  })
})

describe('buildOrthogonalPath', () => {
  it('converts orthogonal route points into an SVG line path', () => {
    expect(
      buildOrthogonalPath([
        { x: 100, y: 200 },
        { x: 180, y: 200 },
        { x: 180, y: 320 },
        { x: 300, y: 320 },
      ])
    ).toBe('M 100 200 L 180 200 L 180 320 L 300 320')
  })
})

describe('inferPortAssignmentsFromRoutes', () => {
  it('chooses the closest routed side from the first and last orthogonal segments', () => {
    const assignments = inferPortAssignmentsFromRoutes(
      buildFlowTopology(orderFlow),
      new Map(),
      new Map([
        [
          'e-2',
          [
            { x: 600, y: 30 },
            { x: 700, y: 30 },
            { x: 700, y: -110 },
          ],
        ],
        [
          'e-3',
          [
            { x: 520, y: 60 },
            { x: 520, y: 220 },
            { x: 700, y: 220 },
            { x: 700, y: 170 },
          ],
        ],
      ])
    )

    expect(assignments.get('e-2')).toMatchObject({ source: 'right', target: 'bottom' })
    expect(assignments.get('e-3')).toMatchObject({ source: 'bottom', target: 'bottom' })
  })
})

describe('bundleSharedSourcePrefixes', () => {
  it('merges the first orthogonal leg for routes that leave the same node side', () => {
    const routes = bundleSharedSourcePrefixes(
      new Map([
        [
          'e-a',
          [
            { x: 520, y: 60 },
            { x: 520, y: 220 },
            { x: 700, y: 220 },
          ],
        ],
        [
          'e-b',
          [
            { x: 520, y: 60 },
            { x: 520, y: 360 },
            { x: 780, y: 360 },
          ],
        ],
      ]),
      new Map([
        ['e-a', { source: 'bottom', target: 'left' }],
        ['e-b', { source: 'bottom', target: 'left' }],
      ])
    )

    // ce0f221 introduced MIN_SHARED_STUB_LENGTH=120: when the natural trunk
    // would land within 120px of the source or the nearest target, the trunk
    // is pulled to the midpoint between them. Here start.y=60 and the nearest
    // target.y=220 are 160px apart, so the clamp range collapses (lo>hi) and
    // the trunk goes to (60 + 220) / 2 = 140.
    expect(routes.get('e-a')).toEqual([
      { x: 520, y: 60 },
      { x: 520, y: 140 },
      { x: 700, y: 140 },
    ])
    // e-b's first rest-element (520, 360) is overwritten with the trunk point
    // (520, 140); the (780, 360) target is then reached via an orthogonal
    // segment added downstream. So this function's output is only 3 points.
    expect(routes.get('e-b')).toEqual([
      { x: 520, y: 60 },
      { x: 520, y: 140 },
      { x: 780, y: 360 },
    ])
  })
})
