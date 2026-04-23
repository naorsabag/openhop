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

  // Layout: place nodes in a horizontal chain (left → right)
  // Fan out for broadcast vertically (±y), sequential steps advance right (+x)
  const isoNodes: IsoNode[] = []
  const placed = new Map<string, { gridX: number; gridY: number }>()

  // Walk steps to determine order
  // Grid step of 2 between buildings so 128x128 sprites don't overlap on a 128x64 tile grid
  const STEP = 2
  let currentX = 0
  const visited = new Set<string>()
  const occupied = new Set<string>() // "gridX,gridY" keys for collision detection

  function placeNode(id: string, gridX: number, gridY: number) {
    placed.set(id, { gridX, gridY })
    visited.add(id)
    occupied.add(`${gridX},${gridY}`)
  }

  function isOccupied(gridX: number, gridY: number) {
    return occupied.has(`${gridX},${gridY}`)
  }

  // Find a free position near (gridX, gridY) by spiraling outward
  function findFreeNear(gridX: number, gridY: number): { gridX: number; gridY: number } {
    if (!isOccupied(gridX, gridY)) return { gridX, gridY }
    // Try offsets: down, right-down, up, further down...
    const offsets = [
      [0, 1], [1, 0], [1, 1], [0, -1], [-1, 0],
      [0, 2], [2, 0], [1, 2], [2, 1], [1, -1], [-1, 1],
    ]
    for (const [dx, dy] of offsets) {
      if (!isOccupied(gridX + dx, gridY + dy)) return { gridX: gridX + dx, gridY: gridY + dy }
    }
    return { gridX, gridY: gridY + 2 }
  }

  for (const step of (steps ?? [])) {
    if (step.parallel) {
      // Parallel steps -- place targets stacked vertically at same X
      for (const ps of step.parallel) {
        if (ps.from && !visited.has(ps.from)) {
          placeNode(ps.from, currentX, 0)
          currentX += STEP
        }
      }
    } else if (step.create && step.from) {
      // Create step: place creator, then created node beside it
      if (step.from && !visited.has(step.from)) {
        placeNode(step.from, currentX, 0)
        currentX += STEP
      }
      if (step.create && !visited.has(step.create)) {
        // Place beside the creator — find free spot near parent
        const parentPos = placed.get(step.from!)
        if (parentPos) {
          const target = findFreeNear(parentPos.gridX + STEP, parentPos.gridY + STEP)
          placeNode(step.create, target.gridX, target.gridY)
        } else {
          const target = findFreeNear(currentX, STEP)
          placeNode(step.create, target.gridX, target.gridY)
        }
      }
    } else {
      if (step.from && !visited.has(step.from)) {
        placeNode(step.from, currentX, 0)
        currentX += STEP
      }
      if (step.to) {
        const targets = Array.isArray(step.to) ? step.to : [step.to]
        if (targets.length > 1) {
          // Broadcast: fan out vertically
          const startY = -(targets.length - 1) * STEP
          targets.forEach((t: string, i: number) => {
            if (!visited.has(t)) {
              const pos = findFreeNear(currentX, startY + i * STEP * 2)
              placeNode(t, pos.gridX, pos.gridY)
            }
          })
          currentX += STEP
        } else {
          const t = targets[0]
          if (t && !visited.has(t)) {
            placeNode(t, currentX, 0)
            currentX += STEP
          }
        }
      }
    }
  }

  // Add any unplaced nodes
  for (const node of flowNodes) {
    if (!visited.has(node.id)) {
      const pos = findFreeNear(currentX, 0)
      placeNode(node.id, pos.gridX, pos.gridY)
      currentX += STEP
    }
  }

  // Also handle dynamic nodes from create steps that weren't placed in the main loop
  for (const step of (steps ?? [])) {
    if ('create' in step && step.create && step.node) {
      if (!placed.has(step.create)) {
        const parentPos = step.from ? placed.get(step.from) : null
        if (parentPos) {
          const target = findFreeNear(parentPos.gridX + STEP, parentPos.gridY + STEP)
          placeNode(step.create, target.gridX, target.gridY)
        } else {
          const target = findFreeNear(currentX, STEP)
          placeNode(step.create, target.gridX, target.gridY)
          currentX += STEP
        }
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

  const gridYValues = Array.from(placed.values()).map(p => p.gridY)

  return {
    nodes: isoNodes,
    edges: isoEdges,
    gridWidth: currentX,
    gridHeight: gridYValues.length > 0 ? Math.max(...gridYValues) + 1 : 1,
  }
}
