import type { Node, Edge } from '@xyflow/react'
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
  // Strategy: build a vertical chain at x=0. Special cases:
  //   - Fan-out (to is array with 2+ targets): spread targets horizontally, centered on x=0.
  //   - Parallel steps: don't advance Y — they represent concurrent responses converging back.
  //   - Create steps: dynamically-created nodes are placed at the next Y position.
  // Nodes are only placed once (first occurrence wins).
  const state: LayoutState = {
    nodeMap: new Map(),
    currentY: 0,
  }
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

  // Collect dynamic nodes from create steps and add to layout
  const dynamicNodeIds = new Set<string>()
  const dynamicNodeDefs = new Map<string, { id: string; label: string; type?: string; icon?: string; color?: string }>()
  for (const step of steps) {
    if ('create' in step && step.create && step.node) {
      const nodeId = step.create
      dynamicNodeIds.add(nodeId)
      dynamicNodeDefs.set(nodeId, step.node as { id: string; label: string; type?: string; icon?: string; color?: string })
      if (!state.nodeMap.has(nodeId)) {
        state.nodeMap.set(nodeId, { x: 0, y: state.currentY })
        state.currentY += Y_SPACING
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

  // Phase 5: Build React Flow edges — one edge per (source, target) per step.
  // Parallel sub-steps and broadcast targets each produce their own edge.
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
    } else if ('create' in step && step.create && step.from) {
      // Create step: edge from creator to new node
      edges.push(makeEdge(edgeIdx++, step.from, step.create, step, stepIndex))
    } else if (step.from && step.to) {
      const targets = Array.isArray(step.to) ? step.to : [step.to]
      for (const t of targets) {
        edges.push(makeEdge(edgeIdx++, step.from, t, step, stepIndex))
      }
    }
  }

  return { nodes, edges }
}

/** Create a React Flow edge with consistent styling and step metadata. */
function makeEdge(idx: number, source: string, target: string, step: FlowStep, stepIndex: number): Edge {
  // Extract a human-readable label from the step's data payload
  const label = typeof step.data === 'string'
    ? step.data
    : Array.isArray(step.data)
      ? step.data.map(d => d.label).join(', ')
      : step.data?.label ?? ''
  return {
    id: `e-${idx}`,
    source,
    target,
    label,
    data: { stepIndex, step },
    style: {
      strokeWidth: 4,
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
