import { MarkerType, type Node, type Edge } from '@xyflow/react'
import type { Flow, FlowStep } from '../types'
import type { FlowNodeData } from '../components/nodes/FlowNode'

const NODE_WIDTH = 160
const NODE_HEIGHT = 60
const X_SPACING = 200
const Y_SPACING = 120

interface LayoutState {
  nodeMap: Map<string, { x: number; y: number }>
  currentY: number
}

/**
 * Convert a Flow definition into React Flow nodes and edges.
 */
export function flowToGraph(flow: Flow): { nodes: Node<FlowNodeData>[]; edges: Edge[] } {
  const { nodes: flowNodes, steps } = flow.flow

  // Build adjacency to determine layout order
  const visited = new Set<string>()
  const ordered: string[] = []

  // Determine the order nodes appear via steps
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

  // Compute how many steps reference each node (as from or to)
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

  // Layout: walk through steps and assign positions
  const state: LayoutState = {
    nodeMap: new Map(),
    currentY: 0,
  }

  // Track which nodes fan out together
  const fanOuts = new Map<string, string[]>() // step index -> fan-out targets

  for (const step of steps) {
    if (step.to && Array.isArray(step.to) && step.to.length > 1) {
      // Fan-out: place targets side by side
      const targets = step.to
      const totalWidth = (targets.length - 1) * X_SPACING
      const startX = -totalWidth / 2

      // Place source first if not placed
      if (step.from && !state.nodeMap.has(step.from)) {
        state.nodeMap.set(step.from, { x: 0, y: state.currentY })
        state.currentY += Y_SPACING
      }

      targets.forEach((t, i) => {
        if (!state.nodeMap.has(t)) {
          state.nodeMap.set(t, { x: startX + i * X_SPACING, y: state.currentY })
        }
      })
      fanOuts.set(step.from ?? '', targets)
      state.currentY += Y_SPACING
    } else if (step.parallel) {
      // Parallel steps don't advance Y — they're responses converging back
      // Don't advance layout, edges will connect back
    } else {
      // Simple edge
      if (step.from && !state.nodeMap.has(step.from)) {
        state.nodeMap.set(step.from, { x: 0, y: state.currentY })
        state.currentY += Y_SPACING
      }
      if (step.to) {
        const target = Array.isArray(step.to) ? step.to[0] : step.to
        if (target && !state.nodeMap.has(target)) {
          state.nodeMap.set(target, { x: 0, y: state.currentY })
          state.currentY += Y_SPACING
        }
      }
    }
  }

  // Build React Flow nodes
  const nodes: Node<FlowNodeData>[] = ordered.map((id) => {
    const flowNode = flowNodeMap.get(id)
    const pos = state.nodeMap.get(id) ?? { x: 0, y: 0 }

    return {
      id,
      type: 'flowNode',
      position: { x: pos.x - NODE_WIDTH / 2 + NODE_WIDTH / 2, y: pos.y },
      data: {
        label: flowNode?.label ?? id,
        nodeType: flowNode?.type ?? 'service',
        color: flowNode?.color,
        icon: flowNode?.icon,
        hasSubFlow: !!flowNode?.flow,
        totalSteps: nodeStepCount.get(id) ?? 0,
        currentStep: 0,
      },
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    }
  })

  // Build edges
  const edges: Edge[] = []
  let edgeIdx = 0

  for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
    const step = steps[stepIndex]
    if (step.parallel) {
      for (const ps of step.parallel) {
        if (ps.from && ps.to) {
          const targets = Array.isArray(ps.to) ? ps.to : [ps.to]
          for (const t of targets) {
            edges.push(makeEdge(edgeIdx++, ps.from, t, ps, stepIndex))
          }
        }
      }
    } else if (step.from && step.to) {
      const targets = Array.isArray(step.to) ? step.to : [step.to]
      for (const t of targets) {
        edges.push(makeEdge(edgeIdx++, step.from, t, step, stepIndex))
      }
    }
  }

  return { nodes, edges }
}

function makeEdge(idx: number, source: string, target: string, step: FlowStep, stepIndex: number): Edge {
  const label = typeof step.data === 'string' ? step.data : step.data.label
  return {
    id: `e-${idx}`,
    source,
    target,
    label,
    data: { stepIndex, step },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: '#2a2a3a',
      width: 16,
      height: 16,
    },
    style: {
      strokeWidth: 6,
      stroke: '#2a2a3a',
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
    type: 'default',
  }
}
