import type { Node, Edge } from '@xyflow/react'
import type { Flow } from '../types'
import type { FlowNodeData } from '../components/nodes/FlowNode'

const NODE_WIDTH = 160
const NODE_HEIGHT = 60
const CELL_W = 220  // horizontal spacing between nodes (left → right)
const CELL_H = 160  // vertical spacing for fanout (broadcast targets)

interface LayoutState {
  nodeMap: Map<string, { x: number; y: number }>
  currentX: number
}

/**
 * Convert a Flow definition into React Flow nodes and edges.
 */
export function flowToGraph(flow: Flow): { nodes: Node<FlowNodeData>[]; edges: Edge[] } {
  const { nodes: flowNodes, steps } = flow.flow

  // Phase 1: Determine node ordering by walking steps in sequence.
  // The first time a node ID appears (as source or target), it gets appended to `ordered`.
  // This produces a topological-ish order that reflects the flow narrative.
  const visited = new Set<string>()
  const ordered: string[] = []
  for (const step of steps) {
    if (step.from && !visited.has(step.from)) {
      visited.add(step.from)
      ordered.push(step.from)
    }
    if (step.to) {
      const targets = Array.isArray(step.to) ? step.to : [step.to]
      for (const t of targets) {
        if (!visited.has(t)) {
          visited.add(t)
          ordered.push(t)
        }
      }
    }
    if (step.parallel) {
      for (const ps of step.parallel) {
        if (ps.from && !visited.has(ps.from)) {
          visited.add(ps.from)
          ordered.push(ps.from)
        }
        if (ps.to) {
          const targets = Array.isArray(ps.to) ? ps.to : [ps.to]
          for (const t of targets) {
            if (!visited.has(t)) {
              visited.add(t)
              ordered.push(t)
            }
          }
        }
      }
    }
  }

  // Add any remaining nodes not referenced in steps
  for (const n of flowNodes) {
    if (!visited.has(n.id)) {
      ordered.push(n.id)
    }
  }

  const flowNodeMap = new Map(flowNodes.map((n) => [n.id, n]))

  // Phase 2: Count how many steps reference each node (as from or to).
  // Used to size the progress bar on each node.
  const nodeStepCount = new Map<string, number>()
  for (const step of steps) {
    const touchedIds = new Set<string>()
    if (step.parallel) {
      for (const ps of step.parallel) {
        if (ps.from) touchedIds.add(ps.from)
        if (ps.to) {
          const targets = Array.isArray(ps.to) ? ps.to : [ps.to]
          for (const t of targets) touchedIds.add(t)
        }
      }
    } else if ('create' in step && step.create) {
      if (step.from) touchedIds.add(step.from)
      touchedIds.add(step.create)
    } else if ('destroy' in step && step.destroy) {
      touchedIds.add(step.destroy)
    } else {
      if (step.from) touchedIds.add(step.from)
      if (step.to) {
        const targets = Array.isArray(step.to) ? step.to : [step.to]
        for (const t of targets) touchedIds.add(t)
      }
    }
    for (const id of touchedIds) {
      nodeStepCount.set(id, (nodeStepCount.get(id) ?? 0) + 1)
    }
  }

  // Phase 3: Layout — assign (x, y) positions by walking steps sequentially.
  // Strategy: build a horizontal chain at y=0 (left → right).  Special cases:
  //   - Fan-out (to is array with 2+ targets): spread targets vertically, centered on y=0.
  //   - Parallel steps: don't advance X — they represent concurrent responses converging back.
  //   - Create steps: dynamically-created nodes are placed at the next X position.
  // Nodes are only placed once (first occurrence wins).
  const state: LayoutState = {
    nodeMap: new Map(),
    currentX: 0,
  }
  for (const step of steps) {
    if (step.to && Array.isArray(step.to) && step.to.length > 1) {
      // Fan-out: spread targets vertically
      const targets = step.to
      const totalHeight = (targets.length - 1) * CELL_H
      const startY = -totalHeight / 2

      // Place source first if not placed
      if (step.from && !state.nodeMap.has(step.from)) {
        state.nodeMap.set(step.from, { x: state.currentX, y: 0 })
        state.currentX += CELL_W
      }

      targets.forEach((t, i) => {
        if (!state.nodeMap.has(t)) {
          state.nodeMap.set(t, { x: state.currentX, y: startY + i * CELL_H })
        }
      })
      state.currentX += CELL_W
    } else if (step.parallel) {
      // Parallel steps don't advance X — they're responses converging back
      // Don't advance layout, edges will connect back
    } else {
      // Simple edge
      if (step.from && !state.nodeMap.has(step.from)) {
        state.nodeMap.set(step.from, { x: state.currentX, y: 0 })
        state.currentX += CELL_W
      }
      if (step.to) {
        const target = Array.isArray(step.to) ? step.to[0] : step.to
        if (target && !state.nodeMap.has(target)) {
          state.nodeMap.set(target, { x: state.currentX, y: 0 })
          state.currentX += CELL_W
        }
      }
    }
  }

  // Collect dynamic nodes from create steps and add to layout
  const dynamicNodeIds = new Set<string>()
  const dynamicNodeDefs = new Map<string, { id: string; label: string; type?: string; icon?: string; color?: string }>()
  for (const step of steps) {
    if ('create' in step && step.create && step.node) {
      const nodeId = step.create
      dynamicNodeIds.add(nodeId)
      dynamicNodeDefs.set(nodeId, step.node as { id: string; label: string; type?: string; icon?: string; color?: string })
      if (!state.nodeMap.has(nodeId)) {
        state.nodeMap.set(nodeId, { x: state.currentX, y: 0 })
        state.currentX += CELL_W
      }
      if (!ordered.includes(nodeId)) {
        ordered.push(nodeId)
      }
      // Count steps referencing this node
      nodeStepCount.set(nodeId, (nodeStepCount.get(nodeId) ?? 0) + 1)
    }
  }

  // Phase 4: Build React Flow node objects from the ordered IDs and computed positions.
  const nodes: Node<FlowNodeData>[] = ordered.map((id) => {
    const flowNode = flowNodeMap.get(id)
    const dynNode = dynamicNodeDefs.get(id)
    const pos = state.nodeMap.get(id) ?? { x: 0, y: 0 }
    const isDynamic = dynamicNodeIds.has(id)

    return {
      id,
      type: 'flowNode',
      position: { x: pos.x, y: pos.y },
      data: {
        label: dynNode?.label ?? flowNode?.label ?? id,
        nodeType: dynNode?.type ?? flowNode?.type ?? 'service',
        color: dynNode?.color ?? flowNode?.color,
        icon: dynNode?.icon ?? flowNode?.icon,
        hasSubFlow: !!flowNode?.flow,
        totalSteps: nodeStepCount.get(id) ?? 0,
        currentStep: 0,
        isDynamic,
      },
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    }
  })

  // Build a position map used by handle selection so each edge picks the shortest
  // straight-line or L-shaped path based on relative node positions.
  const positionMap = new Map<string, { x: number; y: number }>()
  for (const n of nodes) positionMap.set(n.id, n.position)

  // Phase 5: Build React Flow edges — one canonical rendered edge per unordered node pair.
  // Directional flow steps are tracked separately by the animation layer so a single
  // visible road can still carry pixels in either direction.
  const edges: Edge[] = []
  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
  const seenPairs = new Set<string>()
  let edgeIdx = 0

  const pushEdge = (src: string, tgt: string) => {
    const key = pairKey(src, tgt)
    if (seenPairs.has(key)) return
    seenPairs.add(key)
    edges.push(makeEdge(edgeIdx++, src, tgt, positionMap))
  }

  for (const step of steps) {
    if (step.parallel) {
      for (const ps of step.parallel) {
        if (ps.from && ps.to) {
          const targets = Array.isArray(ps.to) ? ps.to : [ps.to]
          for (const t of targets) pushEdge(ps.from, t)
        }
      }
    } else if ('create' in step && step.create && step.from) {
      pushEdge(step.from, step.create)
    } else if (step.from && step.to) {
      const targets = Array.isArray(step.to) ? step.to : [step.to]
      for (const t of targets) pushEdge(step.from, t)
    }
  }

  return { nodes, edges }
}

/**
 * Picks the best (sourceHandle, targetHandle) pair for an edge given the two node positions.
 * Goal: shortest straight-line or L-shaped path. No S-curves.
 *
 * Rule:
 *   - If |dx| >= |dy|: use horizontal handles (source exits right/left, target enters left/right)
 *   - Else:            use vertical handles   (source exits bottom/top, target enters top/bottom)
 *
 * dx = target.x - source.x
 * dy = target.y - source.y
 */
function pickHandles(
  source: { x: number; y: number },
  target: { x: number; y: number },
): { sourceHandle: string; targetHandle: string } {
  const dx = target.x - source.x
  const dy = target.y - source.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    // Horizontal dominant
    if (dx >= 0) return { sourceHandle: 'right', targetHandle: 'left' }
    return { sourceHandle: 'left', targetHandle: 'right' }
  } else {
    // Vertical dominant
    if (dy >= 0) return { sourceHandle: 'bottom', targetHandle: 'top' }
    return { sourceHandle: 'top', targetHandle: 'bottom' }
  }
}

/** Create a React Flow edge with consistent styling and step metadata. */
function makeEdge(
  idx: number,
  source: string,
  target: string,
  positionMap: Map<string, { x: number; y: number }>,
): Edge {
  const sourcePos = positionMap.get(source) ?? { x: 0, y: 0 }
  const targetPos = positionMap.get(target) ?? { x: 0, y: 0 }
  const handles = pickHandles(sourcePos, targetPos)

  return {
    id: `e-${idx}`,
    source,
    target,
    sourceHandle: handles.sourceHandle,
    targetHandle: handles.targetHandle,
    data: { active: false },
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
}
