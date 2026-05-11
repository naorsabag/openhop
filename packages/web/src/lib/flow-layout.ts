import ELK from 'elkjs'
import type { Edge, Node } from '@xyflow/react'
import type { Flow } from '../types'
import type { FlowNodeData } from '../components/nodes/FlowNode'
import { assignNodeVariants, type NodeVariant } from './pixel-palette'

const elk = new ELK()

export const NODE_WIDTH = 108
export const NODE_HEIGHT = 160
const FALLBACK_COLUMN_GAP = 220
const FALLBACK_ROW_GAP = 160
const HANDLE_SPREAD_THRESHOLD = 48

type Position = { x: number; y: number }
type HandleId = 'left' | 'right' | 'top' | 'bottom'
export type RoutePoint = { x: number; y: number }
export type EdgePortAssignment = { source: HandleId; target: HandleId }
type NodeSnapshot = {
  id: string
  label: string
  nodeType: string
  color?: string
  icon?: string
  hasSubFlow: boolean
  totalSteps: number
  isDynamic: boolean
}

export type DisplayEdgeSpec = {
  id: string
  source: string
  target: string
}

export type FlowTopology = {
  orderedIds: string[]
  nodeSnapshots: Map<string, NodeSnapshot>
  displayEdges: DisplayEdgeSpec[]
  layoutEdges: Array<[string, string]>
  /** Per-node sprite + accent variant. Computed once over orderedIds so any
   *  consumer (sprite filter, animated pixel shadow) lands on the same hue. */
  nodeVariants: Map<string, NodeVariant>
}

export type ElKLayoutResult = {
  positions: Map<string, Position>
  routes: Map<string, RoutePoint[]>
  portAssignments: Map<string, EdgePortAssignment>
}

type Step = NonNullable<Flow['flow']['steps']>[number]

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
const HANDLE_TO_ELK_SIDE: Record<HandleId, 'NORTH' | 'EAST' | 'SOUTH' | 'WEST'> = {
  top: 'NORTH',
  right: 'EAST',
  bottom: 'SOUTH',
  left: 'WEST',
}
const HANDLE_ORDER: HandleId[] = ['top', 'right', 'bottom', 'left']

const defaultPosition = (): Position => ({ x: 0, y: 0 })

function isParallelStep(step: Step): step is Extract<Step, { parallel: unknown }> {
  return 'parallel' in step && Array.isArray(step.parallel)
}

function isCreateStep(step: Step): step is Extract<Step, { create: string }> {
  return 'create' in step && typeof step.create === 'string'
}

function isDestroyStep(step: Step): step is Extract<Step, { destroy: string }> {
  return 'destroy' in step && typeof step.destroy === 'string'
}

function hasFrom(step: Step): step is Extract<Step, { from: string }> {
  return 'from' in step && typeof step.from === 'string'
}

function getTargets(value: string | string[] | undefined): string[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function pushOrdered(ordered: string[], seen: Set<string>, id?: string | null) {
  if (!id || seen.has(id)) return
  seen.add(id)
  ordered.push(id)
}

export function buildFlowTopology(flow: Flow): FlowTopology {
  const flowNodes = flow.flow.nodes
  const steps = flow.flow.steps ?? []
  const ordered: string[] = []
  const seenOrdered = new Set<string>()

  for (const step of steps) {
    if (hasFrom(step)) pushOrdered(ordered, seenOrdered, step.from)

    if ('to' in step) {
      for (const target of getTargets(step.to)) pushOrdered(ordered, seenOrdered, target)
    }

    if (isParallelStep(step)) {
      for (const parallelStep of step.parallel) {
        pushOrdered(ordered, seenOrdered, parallelStep.from)
        if (parallelStep.to) {
          for (const target of getTargets(parallelStep.to))
            pushOrdered(ordered, seenOrdered, target)
        }
      }
    }

    if (isCreateStep(step)) {
      pushOrdered(ordered, seenOrdered, step.create)
    }
  }

  for (const node of flowNodes) pushOrdered(ordered, seenOrdered, node.id)

  const flowNodeMap = new Map(flowNodes.map((node) => [node.id, node]))
  const dynamicNodeDefs = new Map<
    string,
    { label: string; type?: string; icon?: string; color?: string }
  >()
  const dynamicNodeIds = new Set<string>()
  const nodeStepCount = new Map<string, number>()

  for (const step of steps) {
    const touchedIds = new Set<string>()

    if (isParallelStep(step)) {
      for (const parallelStep of step.parallel) {
        if (parallelStep.from) touchedIds.add(parallelStep.from)
        if (parallelStep.to) {
          for (const target of getTargets(parallelStep.to)) touchedIds.add(target)
        }
      }
    } else if (isCreateStep(step)) {
      if (step.from) touchedIds.add(step.from)
      touchedIds.add(step.create)
      dynamicNodeIds.add(step.create)
      if (step.node) {
        dynamicNodeDefs.set(step.create, {
          label: step.node.label,
          type: step.node.type,
          icon: step.node.icon,
          color: step.node.color,
        })
      }
    } else if (isDestroyStep(step)) {
      touchedIds.add(step.destroy)
    } else {
      if (hasFrom(step)) touchedIds.add(step.from)
      if ('to' in step) {
        for (const target of getTargets(step.to)) touchedIds.add(target)
      }
    }

    for (const id of touchedIds) {
      nodeStepCount.set(id, (nodeStepCount.get(id) ?? 0) + 1)
    }
  }

  const nodeSnapshots = new Map<string, NodeSnapshot>()
  for (const id of ordered) {
    const flowNode = flowNodeMap.get(id)
    const dynamicNode = dynamicNodeDefs.get(id)
    nodeSnapshots.set(id, {
      id,
      label: dynamicNode?.label ?? flowNode?.label ?? id,
      nodeType: dynamicNode?.type ?? flowNode?.type ?? 'service',
      color: dynamicNode?.color ?? flowNode?.color,
      icon: dynamicNode?.icon ?? flowNode?.icon,
      hasSubFlow: !!flowNode?.flow,
      totalSteps: nodeStepCount.get(id) ?? 0,
      isDynamic: dynamicNodeIds.has(id),
    })
  }

  const displayEdges: DisplayEdgeSpec[] = []
  const seenPairs = new Set<string>()
  let displayEdgeIndex = 0

  const pushDisplayEdge = (source?: string, target?: string) => {
    if (!source || !target) return
    const key = pairKey(source, target)
    if (seenPairs.has(key)) return
    seenPairs.add(key)
    displayEdges.push({ id: `e-${displayEdgeIndex++}`, source, target })
  }

  const layoutEdges: Array<[string, string]> = []
  const layoutSeen = new Set<string>()
  // Back-edges (target already seen) are deferred; we add them later for any
  // node that would otherwise be orphan in the layered layout, so ELK places
  // it on a row instead of floating it on its own.
  const deferredBackEdges: Array<[string, string]> = []

  const pushLayoutEdge = (source?: string, target?: string) => {
    if (!source || !target) return
    layoutSeen.add(source)
    if (layoutSeen.has(target)) {
      deferredBackEdges.push([source, target])
      return
    }
    layoutSeen.add(target)
    layoutEdges.push([source, target])
  }

  for (const step of steps) {
    if (isParallelStep(step)) {
      for (const parallelStep of step.parallel) {
        if (!parallelStep.to) continue
        for (const target of getTargets(parallelStep.to)) {
          pushDisplayEdge(parallelStep.from, target)
          pushLayoutEdge(parallelStep.from, target)
        }
      }
      continue
    }

    if (isCreateStep(step)) {
      pushDisplayEdge(step.from, step.create)
      pushLayoutEdge(step.from, step.create)
      continue
    }

    if (!('to' in step)) continue
    for (const target of getTargets(step.to)) {
      pushDisplayEdge(step.from, target)
      pushLayoutEdge(step.from, target)
    }
  }

  // Promote deferred back-edges for nodes that are otherwise floating — i.e.
  // the source has no other layout edge in or out. Without this, a node like
  // a periodic scheduler that only feeds a previously-seen target gets
  // dropped and ELK places it on its own row.
  const layoutNodeIds = new Set<string>()
  for (const [s, t] of layoutEdges) {
    layoutNodeIds.add(s)
    layoutNodeIds.add(t)
  }
  for (const [source, target] of deferredBackEdges) {
    if (layoutNodeIds.has(source)) continue
    if (source === target) continue
    layoutEdges.push([source, target])
    layoutNodeIds.add(source)
  }

  const nodeVariants = assignNodeVariants(
    ordered.map((id) => ({ id, type: nodeSnapshots.get(id)?.nodeType ?? 'service' }))
  )

  return {
    orderedIds: ordered,
    nodeSnapshots,
    displayEdges,
    layoutEdges,
    nodeVariants,
  }
}

function getBaseHandle(nodePos: Position, neighborPos: Position): HandleId {
  const dx = neighborPos.x - nodePos.x
  const dy = neighborPos.y - nodePos.y

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'right' : 'left'
  }

  return dy >= 0 ? 'bottom' : 'top'
}

function pickHandleWithPeers(
  nodePos: Position,
  neighborPos: Position,
  peers: Array<{ id: string; position: Position }>
): HandleId {
  const baseHandle = getBaseHandle(nodePos, neighborPos)
  const dx = neighborPos.x - nodePos.x
  const dy = neighborPos.y - nodePos.y

  if (baseHandle === 'right' || baseHandle === 'left') {
    const sameSidePeers = peers.filter(({ position }) => {
      const peerDx = position.x - nodePos.x
      return (
        Math.sign(peerDx) === Math.sign(dx) && Math.abs(peerDx) >= Math.abs(position.y - nodePos.y)
      )
    })

    if (sameSidePeers.length > 1) {
      if (dy < -HANDLE_SPREAD_THRESHOLD) return 'top'
      if (dy > HANDLE_SPREAD_THRESHOLD) return 'bottom'
    }

    return baseHandle
  }

  const sameSidePeers = peers.filter(({ position }) => {
    const peerDy = position.y - nodePos.y
    return (
      Math.sign(peerDy) === Math.sign(dy) && Math.abs(peerDy) > Math.abs(position.x - nodePos.x)
    )
  })

  if (sameSidePeers.length > 1) {
    if (dx < -HANDLE_SPREAD_THRESHOLD) return 'left'
    if (dx > HANDLE_SPREAD_THRESHOLD) return 'right'
  }

  return baseHandle
}

function makePositionMap(
  positions: Map<string, Position>,
  orderedIds: string[]
): Map<string, Position> {
  const positionMap = new Map<string, Position>()
  for (const id of orderedIds) {
    positionMap.set(id, positions.get(id) ?? defaultPosition())
  }
  return positionMap
}

function dedupeRoutePoints(points: RoutePoint[]): RoutePoint[] {
  return points.filter((point, index) => {
    const prev = points[index - 1]
    return !prev || prev.x !== point.x || prev.y !== point.y
  })
}

function chooseOrthogonalCorner(
  previous: RoutePoint | undefined,
  current: RoutePoint,
  next: RoutePoint,
  following: RoutePoint | undefined
): RoutePoint {
  if (previous) {
    if (previous.x === current.x && previous.y !== current.y) return { x: next.x, y: current.y }
    if (previous.y === current.y && previous.x !== current.x) return { x: current.x, y: next.y }
  }

  if (following) {
    if (following.x === next.x && following.y !== next.y) return { x: next.x, y: current.y }
    if (following.y === next.y && following.x !== next.x) return { x: current.x, y: next.y }
  }

  return { x: next.x, y: current.y }
}

// Sub-pixel epsilon for orthogonality checks. After shiftRoutesAfterSnap,
// two points that should share a coordinate can drift by ~1 ULP (3e-15) due
// to float arithmetic. Without this tolerance, orthogonalize inserts a
// phantom corner and inferPortAssignmentsFromRoutes then treats a tiny dy
// as the dominant axis — picking 'bottom' for what should be a flat
// 'left' entry. (Seen on claude-router → mongodb in the orion main flow.)
const ORTHOGONAL_EPSILON = 0.5

export function orthogonalizeRoutePoints(points: RoutePoint[]): RoutePoint[] {
  const route: RoutePoint[] = []

  for (let index = 0; index < points.length; index++) {
    const point = points[index]
    const current = route[route.length - 1]

    if (!current) {
      route.push(point)
      continue
    }

    if (
      Math.abs(current.x - point.x) > ORTHOGONAL_EPSILON &&
      Math.abs(current.y - point.y) > ORTHOGONAL_EPSILON
    ) {
      const corner = chooseOrthogonalCorner(
        route[route.length - 2],
        current,
        point,
        points[index + 1]
      )
      route.push(corner)
    }

    route.push(point)
  }

  return dedupeRoutePoints(route)
}

export function buildOrthogonalPath(points: RoutePoint[]): string | null {
  const deduped = orthogonalizeRoutePoints(dedupeRoutePoints(points))
  if (deduped.length < 2) return null

  return deduped.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
}

/**
 * Extend the route's start/end inward so roads visually enter the center of
 * each node (instead of stopping at the bounding-box edge where the port sits).
 */
function extendRouteToNodeCenters(
  route: RoutePoint[],
  assignment: EdgePortAssignment | undefined
): RoutePoint[] {
  if (route.length < 2 || !assignment) return route
  const start = route[0]
  const end = route[route.length - 1]
  const innerStart = shiftInward(start, assignment.source)
  const innerEnd = shiftInward(end, assignment.target)
  return [innerStart, ...route, innerEnd]
}

// Roads stop 43% of the way into the node (instead of at the center) so the
// sprite's silhouette reads clearly but the road still clearly "connects".
const INWARD_SHIFT_RATIO = 0.42

function shiftInward(port: RoutePoint, side: HandleId): RoutePoint {
  const dx = NODE_WIDTH * INWARD_SHIFT_RATIO
  const dy = NODE_HEIGHT * INWARD_SHIFT_RATIO
  switch (side) {
    case 'right':
      return { x: port.x - dx, y: port.y }
    case 'left':
      return { x: port.x + dx, y: port.y }
    case 'bottom':
      return { x: port.x, y: port.y - dy }
    case 'top':
      return { x: port.x, y: port.y + dy }
  }
}

function anchorForHandle(position: Position, handle: HandleId): RoutePoint {
  switch (handle) {
    case 'top':
      return { x: position.x + NODE_WIDTH / 2, y: position.y }
    case 'right':
      return { x: position.x + NODE_WIDTH, y: position.y + NODE_HEIGHT / 2 }
    case 'bottom':
      return { x: position.x + NODE_WIDTH / 2, y: position.y + NODE_HEIGHT }
    case 'left':
      return { x: position.x, y: position.y + NODE_HEIGHT / 2 }
  }
}

function nearestHandle(position: Position, point: RoutePoint): HandleId {
  let bestHandle: HandleId = 'right'
  let bestDistance = Number.POSITIVE_INFINITY

  for (const handle of HANDLE_ORDER) {
    const anchor = anchorForHandle(position, handle)
    const dx = point.x - anchor.x
    const dy = point.y - anchor.y
    const distance = Math.hypot(dx, dy)
    if (distance < bestDistance) {
      bestDistance = distance
      bestHandle = handle
    }
  }

  return bestHandle
}

function targetHandleFromSegment(dx: number, dy: number): HandleId {
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'left' : 'right'
  }

  return dy >= 0 ? 'top' : 'bottom'
}

export function inferPortAssignmentsFromRoutes(
  topology: FlowTopology,
  positions: Map<string, Position>,
  routes: Map<string, RoutePoint[]>
): Map<string, EdgePortAssignment> {
  const assignments = new Map<string, EdgePortAssignment>()

  for (const edge of topology.displayEdges) {
    const route = routes.get(edge.id)
    const sourcePos = positions.get(edge.source) ?? defaultPosition()
    const targetPos = positions.get(edge.target) ?? defaultPosition()

    if (!route || route.length < 2) {
      assignments.set(edge.id, {
        source: pickHandleWithPeers(sourcePos, targetPos, [
          { id: edge.target, position: targetPos },
        ]),
        target: pickHandleWithPeers(targetPos, sourcePos, [
          { id: edge.source, position: sourcePos },
        ]),
      })
      continue
    }

    const first = route[0]
    const second = route[1]
    const penultimate = route[route.length - 2]
    const last = route[route.length - 1]
    const dxStart = second.x - first.x
    const dyStart = second.y - first.y
    const dxEnd = last.x - penultimate.x
    const dyEnd = last.y - penultimate.y

    assignments.set(edge.id, {
      source:
        dxStart === 0 && dyStart === 0
          ? nearestHandle(sourcePos, second)
          : getBaseHandle(first, second),
      target:
        dxEnd === 0 && dyEnd === 0
          ? nearestHandle(targetPos, penultimate)
          : targetHandleFromSegment(dxEnd, dyEnd),
    })
  }

  return assignments
}

const MIN_SHARED_STUB_LENGTH = 120
export const SELF_LOOP_WIDTH = 48
export const SELF_LOOP_HEIGHT = 40

/**
 * Build a self-loop "ear" route — exits the node's right port, hooks up and
 * over the top-right corner, and re-enters via the top port. Returns the
 * route in the same shape ELK would produce so it flows through the rest of
 * the rendering pipeline (path extension, RoadEdge, pixel animation).
 */
function buildSelfLoopRoute(position: Position): {
  route: RoutePoint[]
  assignment: EdgePortAssignment
} {
  const sourceAnchor = anchorForHandle(position, 'right')
  const targetAnchor = anchorForHandle(position, 'top')
  const route: RoutePoint[] = [
    sourceAnchor,
    { x: sourceAnchor.x + SELF_LOOP_WIDTH, y: sourceAnchor.y },
    { x: sourceAnchor.x + SELF_LOOP_WIDTH, y: targetAnchor.y - SELF_LOOP_HEIGHT },
    { x: targetAnchor.x, y: targetAnchor.y - SELF_LOOP_HEIGHT },
    targetAnchor,
  ]
  return { route, assignment: { source: 'right', target: 'top' } }
}

export function bundleSharedSourcePrefixes(
  routes: Map<string, RoutePoint[]>,
  assignments: Map<string, EdgePortAssignment>
): Map<string, RoutePoint[]> {
  const bundled = new Map<string, RoutePoint[]>()
  for (const [edgeId, route] of routes) {
    bundled.set(
      edgeId,
      route.map((point) => ({ ...point }))
    )
  }

  const groups = new Map<string, Array<{ edgeId: string; route: RoutePoint[]; side: HandleId }>>()

  for (const [edgeId, route] of bundled) {
    const assignment = assignments.get(edgeId)
    if (!assignment || route.length < 2) continue
    const key = `${route[0].x},${route[0].y}:${assignment.source}`
    const group = groups.get(key) ?? []
    group.push({ edgeId, route, side: assignment.source })
    groups.set(key, group)
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue

    const side = group[0].side
    const start = group[0].route[0]
    if (side === 'right' || side === 'left') {
      const bent = group.filter(({ route }) => route.length >= 3)
      if (bent.length === 0) continue
      const naturalTrunkX =
        side === 'right'
          ? Math.min(...bent.map(({ route }) => route[1].x))
          : Math.max(...bent.map(({ route }) => route[1].x))
      const nearestTargetX =
        side === 'right'
          ? Math.min(...group.map(({ route }) => route[route.length - 1].x))
          : Math.max(...group.map(({ route }) => route[route.length - 1].x))
      const lo =
        side === 'right'
          ? start.x + MIN_SHARED_STUB_LENGTH
          : nearestTargetX + MIN_SHARED_STUB_LENGTH
      const hi =
        side === 'right'
          ? nearestTargetX - MIN_SHARED_STUB_LENGTH
          : start.x - MIN_SHARED_STUB_LENGTH
      const trunkX =
        lo > hi ? (start.x + nearestTargetX) / 2 : Math.min(hi, Math.max(lo, naturalTrunkX))

      for (const item of bent) {
        const [edgeStart, ...rest] = item.route
        const shifted = rest.map((p) => (p.x === naturalTrunkX ? { x: trunkX, y: p.y } : p))
        shifted[0] = { x: trunkX, y: edgeStart.y }
        bundled.set(item.edgeId, dedupeRoutePoints([edgeStart, ...shifted]))
      }
      continue
    }

    if (side === 'bottom' || side === 'top') {
      const bent = group.filter(({ route }) => route.length >= 3)
      if (bent.length === 0) continue
      const naturalTrunkY =
        side === 'bottom'
          ? Math.min(...bent.map(({ route }) => route[1].y))
          : Math.max(...bent.map(({ route }) => route[1].y))
      const nearestTargetY =
        side === 'bottom'
          ? Math.min(...group.map(({ route }) => route[route.length - 1].y))
          : Math.max(...group.map(({ route }) => route[route.length - 1].y))
      const lo =
        side === 'bottom'
          ? start.y + MIN_SHARED_STUB_LENGTH
          : nearestTargetY + MIN_SHARED_STUB_LENGTH
      const hi =
        side === 'bottom'
          ? nearestTargetY - MIN_SHARED_STUB_LENGTH
          : start.y - MIN_SHARED_STUB_LENGTH
      const trunkY =
        lo > hi ? (start.y + nearestTargetY) / 2 : Math.min(hi, Math.max(lo, naturalTrunkY))

      for (const item of bent) {
        const [edgeStart, ...rest] = item.route
        const shifted = rest.map((p) => (p.y === naturalTrunkY ? { x: p.x, y: trunkY } : p))
        shifted[0] = { x: edgeStart.x, y: trunkY }
        bundled.set(item.edgeId, dedupeRoutePoints([edgeStart, ...shifted]))
      }
    }
  }

  return bundleSharedTargetSuffixes(bundled, assignments)
}

function bundleSharedTargetSuffixes(
  routes: Map<string, RoutePoint[]>,
  assignments: Map<string, EdgePortAssignment>
): Map<string, RoutePoint[]> {
  const groups = new Map<string, Array<{ edgeId: string; route: RoutePoint[]; side: HandleId }>>()
  for (const [edgeId, route] of routes) {
    const assignment = assignments.get(edgeId)
    if (!assignment || route.length < 2) continue
    const end = route[route.length - 1]
    const key = `${end.x},${end.y}:${assignment.target}`
    const group = groups.get(key) ?? []
    group.push({ edgeId, route, side: assignment.target })
    groups.set(key, group)
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue
    const bent = group.filter((g) => g.route.length >= 3)
    if (bent.length === 0) continue
    const side = group[0].side
    const end = group[0].route[group[0].route.length - 1]
    if (side === 'left' || side === 'right') {
      const naturalApproachX =
        side === 'left'
          ? Math.max(...bent.map(({ route }) => route[route.length - 2].x))
          : Math.min(...bent.map(({ route }) => route[route.length - 2].x))
      const desiredApproachX =
        side === 'left' ? end.x - MIN_SHARED_STUB_LENGTH : end.x + MIN_SHARED_STUB_LENGTH
      const approachX =
        side === 'left'
          ? Math.max(naturalApproachX, desiredApproachX)
          : Math.min(naturalApproachX, desiredApproachX)
      for (const item of bent) {
        const route = item.route
        const tail = route[route.length - 1]
        const shifted = route
          .slice(0, -1)
          .map((p) => (p.x === naturalApproachX ? { x: approachX, y: p.y } : p))
        shifted[shifted.length - 1] = { x: approachX, y: tail.y }
        routes.set(item.edgeId, dedupeRoutePoints([...shifted, tail]))
      }
      continue
    }
    if (side === 'top' || side === 'bottom') {
      const naturalApproachY =
        side === 'top'
          ? Math.max(...bent.map(({ route }) => route[route.length - 2].y))
          : Math.min(...bent.map(({ route }) => route[route.length - 2].y))
      const desiredApproachY =
        side === 'top' ? end.y - MIN_SHARED_STUB_LENGTH : end.y + MIN_SHARED_STUB_LENGTH
      const approachY =
        side === 'top'
          ? Math.max(naturalApproachY, desiredApproachY)
          : Math.min(naturalApproachY, desiredApproachY)
      for (const item of bent) {
        const route = item.route
        const tail = route[route.length - 1]
        const shifted = route
          .slice(0, -1)
          .map((p) => (p.y === naturalApproachY ? { x: p.x, y: approachY } : p))
        shifted[shifted.length - 1] = { x: tail.x, y: approachY }
        routes.set(item.edgeId, dedupeRoutePoints([...shifted, tail]))
      }
    }
  }
  return routes
}

export function buildReactFlowGraph(
  topology: FlowTopology,
  positions: Map<string, Position>,
  routes?: Map<string, RoutePoint[]>,
  portAssignments?: Map<string, EdgePortAssignment>
): { nodes: Node<FlowNodeData>[]; edges: Edge[] } {
  const positionMap = makePositionMap(positions, topology.orderedIds)

  const outgoingBySource = new Map<string, Array<{ id: string; position: Position }>>()
  const incomingByTarget = new Map<string, Array<{ id: string; position: Position }>>()

  for (const edge of topology.displayEdges) {
    const sourcePosition = positionMap.get(edge.target) ?? defaultPosition()
    const targetPosition = positionMap.get(edge.source) ?? defaultPosition()

    const outgoing = outgoingBySource.get(edge.source) ?? []
    outgoing.push({ id: edge.target, position: sourcePosition })
    outgoingBySource.set(edge.source, outgoing)

    const incoming = incomingByTarget.get(edge.target) ?? []
    incoming.push({ id: edge.source, position: targetPosition })
    incomingByTarget.set(edge.target, incoming)
  }

  // Per-node variant: precomputed once on the topology so the sprite filter
  // here and the data-pixel drop-shadow in FlowCanvas read from the same
  // palette index.
  const nodes: Node<FlowNodeData>[] = topology.orderedIds.map((id) => {
    const snapshot = topology.nodeSnapshots.get(id)
    const position = positionMap.get(id) ?? defaultPosition()
    const nodeType = snapshot?.nodeType ?? 'service'
    const variant = topology.nodeVariants.get(id)
    const variantFilter = variant?.filter
    const variantColor = variant?.color ?? '#ff8a4a'

    return {
      id,
      type: 'flowNode',
      position,
      data: {
        label: snapshot?.label ?? id,
        nodeType,
        color: snapshot?.color,
        icon: snapshot?.icon,
        hasSubFlow: snapshot?.hasSubFlow ?? false,
        totalSteps: snapshot?.totalSteps ?? 0,
        currentStep: 0,
        isDynamic: snapshot?.isDynamic ?? false,
        variantFilter,
        variantColor,
      },
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    }
  })

  const edges: Edge[] = topology.displayEdges.map((edge) => {
    const sourcePos = positionMap.get(edge.source) ?? defaultPosition()
    const targetPos = positionMap.get(edge.target) ?? defaultPosition()
    const isSelfLoop = edge.source === edge.target
    const selfLoop = isSelfLoop ? buildSelfLoopRoute(sourcePos) : null
    const assignment = selfLoop?.assignment ?? portAssignments?.get(edge.id)
    const rawRoute = selfLoop?.route ?? routes?.get(edge.id) ?? []
    const extendedRoute = extendRouteToNodeCenters(rawRoute, assignment)
    const elkPath = buildOrthogonalPath(extendedRoute)

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle:
        selfLoop?.assignment.source ??
        portAssignments?.get(edge.id)?.source ??
        pickHandleWithPeers(sourcePos, targetPos, outgoingBySource.get(edge.source) ?? []),
      targetHandle:
        selfLoop?.assignment.target ??
        portAssignments?.get(edge.id)?.target ??
        pickHandleWithPeers(targetPos, sourcePos, incomingByTarget.get(edge.target) ?? []),
      data: {
        active: false,
        ...(elkPath ? { elkPath } : null),
      },
      labelStyle: {
        fontFamily: '"VT323", monospace',
        fontSize: 14,
        fill: '#888',
      },
      labelBgStyle: {
        fill: '#0a0a1a',
        fillOpacity: 0.85,
      },
      labelBgPadding: [6, 4] as [number, number],
      type: 'road',
    }
  })

  return { nodes, edges }
}

export function computeFallbackPositions(topology: FlowTopology): Map<string, Position> {
  const positions = new Map<string, Position>()
  const incomingCounts = new Map<string, number>()
  const levels = new Map<string, number>()

  for (const id of topology.orderedIds) {
    incomingCounts.set(id, 0)
  }

  for (const [source, target] of topology.layoutEdges) {
    incomingCounts.set(target, (incomingCounts.get(target) ?? 0) + 1)
    levels.set(source, Math.max(levels.get(source) ?? 0, levels.get(source) ?? 0))
  }

  const queue = topology.orderedIds.filter((id) => (incomingCounts.get(id) ?? 0) === 0)
  for (const id of queue) levels.set(id, 0)

  while (queue.length > 0) {
    const current = queue.shift()!
    const currentLevel = levels.get(current) ?? 0
    for (const [source, target] of topology.layoutEdges) {
      if (source !== current) continue
      levels.set(target, Math.max(levels.get(target) ?? 0, currentLevel + 1))
      incomingCounts.set(target, (incomingCounts.get(target) ?? 1) - 1)
      if ((incomingCounts.get(target) ?? 0) === 0) queue.push(target)
    }
  }

  const layers = new Map<number, string[]>()
  for (const id of topology.orderedIds) {
    const level = levels.get(id) ?? 0
    const layer = layers.get(level) ?? []
    layer.push(id)
    layers.set(level, layer)
  }

  for (const [level, ids] of Array.from(layers.entries()).sort((a, b) => a[0] - b[0])) {
    const totalHeight = (ids.length - 1) * FALLBACK_ROW_GAP
    const startY = -totalHeight / 2
    ids.forEach((id, index) => {
      positions.set(id, {
        x: level * FALLBACK_COLUMN_GAP,
        y: startY + index * FALLBACK_ROW_GAP,
      })
    })
  }

  return positions
}

function buildElkGraph(topology: FlowTopology, portAssignments?: Map<string, EdgePortAssignment>) {
  // Pre-compute which nodes have an incoming edge from ANOTHER actor.
  // Those can't be pinned to ELK's FIRST layer — ELK throws
  // UnsupportedConfigurationException if a FIRST node receives an
  // intra-layer edge from another FIRST node. Skipping the pin only
  // when the source is also an actor keeps the common case ("user is
  // both first sender and final receiver of a response") working —
  // because the response edge's source is typically a service/endpoint,
  // not another actor.
  const incomingFromActor = new Set<string>()
  for (const e of topology.displayEdges) {
    // Self-loop (source === target) doesn't introduce a second
    // FIRST-pinned node, so it can't trigger the ELK error this guard
    // protects against — exclude it.
    if (e.source !== e.target && topology.nodeSnapshots.get(e.source)?.nodeType === 'actor') {
      incomingFromActor.add(e.target)
    }
  }

  return {
    id: 'openhop-flow',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'portAlignment.default': 'CENTER',
      'elk.spacing.nodeNode': '80',
      'elk.layered.spacing.nodeNodeBetweenLayers': '200',
      // Pull edge corridors apart so back-edges (e.g. results → api in the
      // orion flow) don't share a vertical lane with a forward edge between
      // the same source-side node and a different target. Prior to bumping
      // these, results → api routed at x=774 while api → jenkins ran at
      // x=864 — visually two parallel roads that read as "two edges between
      // api and jenkins."
      'elk.spacing.edgeEdge': '40',
      'elk.spacing.edgeNode': '40',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '40',
      'elk.layered.spacing.edgeNodeBetweenLayers': '40',
      'elk.padding': '[top=40,left=40,bottom=40,right=40]',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.crossingMinimization.forceNodeModelOrder': 'true',
    },
    children: topology.orderedIds.map((id) => {
      const ports = HANDLE_ORDER.map((handle) => ({
        id: `${id}:${handle}`,
        layoutOptions: {
          'org.eclipse.elk.port.side': HANDLE_TO_ELK_SIDE[handle],
        },
      }))

      // Actors represent the human/external initiator — pin them to the
      // leftmost layer so the flow always reads "user → system → ..."
      // (including when the actor is also the final response target).
      // Skip the pin only for actors fed by another actor (see
      // incomingFromActor above) — ELK rejects intra-layer FIRST→FIRST
      // edges.
      const isActor = topology.nodeSnapshots.get(id)?.nodeType === 'actor'
      const pinFirst = isActor && !incomingFromActor.has(id)
      const nodeLayoutOptions: Record<string, string> = {}
      if (portAssignments) nodeLayoutOptions.portConstraints = 'FIXED_SIDE'
      if (pinFirst) nodeLayoutOptions['elk.layered.layering.layerConstraint'] = 'FIRST'

      return {
        id,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        ...(Object.keys(nodeLayoutOptions).length > 0
          ? { layoutOptions: nodeLayoutOptions }
          : null),
        ...(portAssignments ? { ports } : null),
      }
    }),
    edges: topology.displayEdges.map((edge) => ({
      id: edge.id,
      sources: [
        portAssignments
          ? `${edge.source}:${portAssignments.get(edge.id)?.source ?? 'right'}`
          : edge.source,
      ],
      targets: [
        portAssignments
          ? `${edge.target}:${portAssignments.get(edge.id)?.target ?? 'left'}`
          : edge.target,
      ],
    })),
  }
}

/**
 * Snap each node's y to the nearest row of a shared grid so off-grid nodes
 * (e.g. an outlier introduced by a back-edge connection like a cron source)
 * line up with the rest of the layout. Returns the per-node y-deltas so
 * routes can be shifted in lockstep — without that, routes that ELK
 * computed against pre-snap positions drift from the snapped nodes.
 */
function snapPositionsToRowGrid(positions: Map<string, Position>): Map<string, number> {
  const deltas = new Map<string, number>()
  if (positions.size === 0) return deltas
  const ROW_PITCH = NODE_HEIGHT + 80
  const ys = [...positions.values()].map((p) => p.y).sort((a, b) => a - b)
  const baseY = ys[0]
  for (const [id, pos] of positions) {
    const k = Math.round((pos.y - baseY) / ROW_PITCH)
    const newY = baseY + k * ROW_PITCH
    deltas.set(id, newY - pos.y)
    positions.set(id, { x: pos.x, y: newY })
  }
  return deltas
}

/**
 * Shift each route in lockstep with the y-snap applied to its source and
 * target nodes. Source-side points (y == route[0].y) move by Δsource;
 * target-side points (y == route[last].y) move by Δtarget. Intermediate
 * vertical-bend points (y matching neither port-y) keep their value since
 * the orthogonal turn logically belongs to whichever side it connects to;
 * here we leave them alone, which is correct for the H-V-H routes ELK
 * produces in this layout.
 */
function shiftRoutesAfterSnap(
  routes: Map<string, RoutePoint[]>,
  topology: FlowTopology,
  deltas: Map<string, number>
): void {
  for (const edge of topology.displayEdges) {
    const route = routes.get(edge.id)
    if (!route || route.length < 2) continue
    const dSource = deltas.get(edge.source) ?? 0
    const dTarget = deltas.get(edge.target) ?? 0
    if (dSource === 0 && dTarget === 0) continue
    const sourceY = route[0].y
    const targetY = route[route.length - 1].y
    const shifted = route.map((p) => {
      if (Math.abs(p.y - sourceY) < 0.5) return { x: p.x, y: p.y + dSource }
      if (Math.abs(p.y - targetY) < 0.5) return { x: p.x, y: p.y + dTarget }
      return p
    })
    routes.set(edge.id, shifted)
  }
}

function extractElkLayout(graph: Awaited<ReturnType<typeof elk.layout>>) {
  const positions = new Map<string, Position>()
  for (const child of graph.children ?? []) {
    positions.set(child.id, {
      x: child.x ?? 0,
      y: child.y ?? 0,
    })
  }

  const routes = new Map<string, RoutePoint[]>()
  for (const edge of graph.edges ?? []) {
    const points: RoutePoint[] = []
    for (const section of edge.sections ?? []) {
      if (section.startPoint) points.push({ x: section.startPoint.x, y: section.startPoint.y })
      for (const bendPoint of section.bendPoints ?? []) {
        points.push({ x: bendPoint.x, y: bendPoint.y })
      }
      if (section.endPoint) points.push({ x: section.endPoint.x, y: section.endPoint.y })
    }
    if (points.length > 1) routes.set(edge.id, dedupeRoutePoints(points))
  }

  return { positions, routes }
}

export async function computeElkLayout(topology: FlowTopology): Promise<ElKLayoutResult> {
  const firstPass = extractElkLayout(await elk.layout(buildElkGraph(topology)))
  const firstDeltas = snapPositionsToRowGrid(firstPass.positions)
  shiftRoutesAfterSnap(firstPass.routes, topology, firstDeltas)
  // Normalize routes the same way buildOrthogonalPath does so port-side
  // inference looks at corrected (orthogonal, deduped) endpoint segments
  // rather than raw ELK polylines that may contain a diagonal nub.
  const normalizedFirstRoutes = new Map<string, RoutePoint[]>()
  for (const [edgeId, route] of firstPass.routes) {
    normalizedFirstRoutes.set(edgeId, orthogonalizeRoutePoints(dedupeRoutePoints(route)))
  }
  const inferredAssignments = inferPortAssignmentsFromRoutes(
    topology,
    firstPass.positions,
    normalizedFirstRoutes
  )
  const secondPass = extractElkLayout(
    await elk.layout(buildElkGraph(topology, inferredAssignments))
  )
  const secondDeltas = snapPositionsToRowGrid(secondPass.positions)
  shiftRoutesAfterSnap(secondPass.routes, topology, secondDeltas)
  const bundledRoutes = bundleSharedSourcePrefixes(secondPass.routes, inferredAssignments)

  return {
    positions: secondPass.positions,
    routes: bundledRoutes,
    portAssignments: inferredAssignments,
  }
}
