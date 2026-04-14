import type { Flow, FlowStep } from '../types'

export interface IsoNode {
  id: string
  label: string
  nodeType: string
  gridX: number
  gridY: number
  icon?: string
  color?: string
  hasSubFlow: boolean
  isDynamic: boolean
}

export interface IsoEdge {
  from: string
  to: string
  stepIndex: number
  step: FlowStep
}

export interface IsoLayout {
  nodes: IsoNode[]
  edges: IsoEdge[]
  gridWidth: number
  gridHeight: number
}

export function computeLayout(flow: Flow): IsoLayout {
  const { nodes: flowNodes, steps } = flow.flow

  // Simple layout: place nodes in a vertical chain
  // Fan out for broadcast, side-by-side for parallel
  const isoNodes: IsoNode[] = []
  const placed = new Map<string, { gridX: number; gridY: number }>()

  // Walk steps to determine order
  let currentY = 0
  const visited = new Set<string>()

  for (const step of (steps ?? [])) {
    if (step.parallel) {
      // Parallel steps -- place targets side by side
      for (const ps of step.parallel) {
        if (ps.from && !visited.has(ps.from)) {
          placed.set(ps.from, { gridX: 0, gridY: currentY })
          visited.add(ps.from)
          currentY++
        }
      }
    } else if (step.create && step.from) {
      // Create step: place creator, then created node to the side
      if (step.from && !visited.has(step.from)) {
        placed.set(step.from, { gridX: 0, gridY: currentY })
        visited.add(step.from)
        currentY++
      }
      if (step.create && !visited.has(step.create)) {
        placed.set(step.create, { gridX: 2, gridY: currentY - 1 }) // side position
        visited.add(step.create)
      }
    } else {
      if (step.from && !visited.has(step.from)) {
        placed.set(step.from, { gridX: 0, gridY: currentY })
        visited.add(step.from)
        currentY++
      }
      if (step.to) {
        const targets = Array.isArray(step.to) ? step.to : [step.to]
        if (targets.length > 1) {
          // Broadcast: fan out
          const startX = -(targets.length - 1)
          targets.forEach((t, i) => {
            if (!visited.has(t)) {
              placed.set(t, { gridX: startX + i * 2, gridY: currentY })
              visited.add(t)
            }
          })
          currentY++
        } else {
          const t = targets[0]
          if (t && !visited.has(t)) {
            placed.set(t, { gridX: 0, gridY: currentY })
            visited.add(t)
            currentY++
          }
        }
      }
    }
  }

  // Add any unplaced nodes
  for (const node of flowNodes) {
    if (!visited.has(node.id)) {
      placed.set(node.id, { gridX: 0, gridY: currentY })
      currentY++
    }
  }

  // Also handle dynamic nodes from create steps
  for (const step of (steps ?? [])) {
    if ('create' in step && step.create && step.node) {
      if (!visited.has(step.create)) {
        placed.set(step.create, { gridX: 2, gridY: currentY })
        currentY++
      }
    }
  }

  // Build IsoNode array
  const flowNodeMap = new Map(flowNodes.map(n => [n.id, n]))
  for (const [id, pos] of placed) {
    const flowNode = flowNodeMap.get(id)
    // Also check create steps for dynamic node definitions
    let dynamicNode: { id: string; label: string; type?: string; icon?: string; color?: string } | null = null
    for (const step of (steps ?? [])) {
      if ('create' in step && step.create === id && step.node) {
        dynamicNode = step.node as { id: string; label: string; type?: string; icon?: string; color?: string }
        break
      }
    }

    const label = dynamicNode?.label ?? flowNode?.label ?? id
    const nodeType = dynamicNode?.type ?? flowNode?.type ?? 'transform'

    isoNodes.push({
      id,
      label,
      nodeType,
      gridX: pos.gridX,
      gridY: pos.gridY,
      icon: dynamicNode?.icon ?? flowNode?.icon,
      color: dynamicNode?.color ?? flowNode?.color,
      hasSubFlow: !!flowNode?.flow,
      isDynamic: !!dynamicNode,
    })
  }

  // Build edges
  const isoEdges: IsoEdge[] = []
  if (steps) {
    steps.forEach((step, idx) => {
      if (step.parallel) {
        step.parallel.forEach(ps => {
          if (ps.from && ps.to) {
            const targets = Array.isArray(ps.to) ? ps.to : [ps.to]
            targets.forEach(t => isoEdges.push({ from: ps.from!, to: t, stepIndex: idx, step: ps }))
          }
        })
      } else if (step.create && step.from) {
        isoEdges.push({ from: step.from, to: step.create, stepIndex: idx, step })
      } else if (step.from && step.to) {
        const targets = Array.isArray(step.to) ? step.to : [step.to]
        targets.forEach(t => isoEdges.push({ from: step.from!, to: t, stepIndex: idx, step }))
      }
    })
  }

  const gridXValues = Array.from(placed.values()).map(p => p.gridX)

  return {
    nodes: isoNodes,
    edges: isoEdges,
    gridWidth: gridXValues.length > 0 ? Math.max(...gridXValues) + 1 : 1,
    gridHeight: currentY,
  }
}
