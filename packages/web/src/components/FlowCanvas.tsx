import {
  ReactFlow,
  Background,
  Controls,
  type NodeTypes,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import { FlowNodeComponent, type FlowNodeData } from './nodes/FlowNode'
import { flowToGraph } from '../lib/flow-to-graph'
import { useFlowAnimation } from '../hooks/useFlowAnimation'
import { DataPixel } from './DataPixel'
import { DataPopup } from './DataPopup'
import type { Flow, FlowStep, FlowData } from '../types'

const nodeTypes: NodeTypes = {
  flowNode: FlowNodeComponent,
}

interface FlowCanvasProps {
  flow: Flow
  playing: boolean
  onDrillDown?: (nodeId: string) => void
  onDrilldownStep?: (nodeId: string, atStepIndex: number) => void
  onCycleComplete?: () => void
  startFromStep?: number
  onStepChange?: (stepIndex: number) => void
}

/** Inner component that can use useReactFlow (needs ReactFlowProvider context) */
function FlowCanvasInner({ flow, playing, onDrillDown, onDrilldownStep, onCycleComplete, startFromStep, onStepChange }: FlowCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pinnedEdge, setPinnedEdge] = useState<{
    edgeId: string
    steps: FlowStep[]
    position: { x: number; y: number }
  } | null>(null)

  const { nodes: baseNodes, edges: baseEdges } = useMemo(
    () => flowToGraph(flow),
    [flow],
  )

  const handlePinPopup = useCallback((step: FlowStep, position: { x: number; y: number }, edgeId?: string) => {
    const id = edgeId ?? '__pixel__'
    if (pinnedEdge?.edgeId === id) {
      setPinnedEdge(null)
      return
    }
    // If the step has array data, create virtual steps (one per data object) for pagination
    let edgeSteps: FlowStep[]
    if (Array.isArray(step.data)) {
      edgeSteps = step.data.map(d => ({ ...step, data: d }))
    } else {
      edgeSteps = [step]
    }
    if (id !== '__pixel__') {
      const targetEdge = baseEdges.find(e => e.id === id)
      if (targetEdge) {
        for (const e of baseEdges) {
          if (e.id !== id && e.source === targetEdge.source && e.target === targetEdge.target) {
            const s = (e.data as { step?: FlowStep } | undefined)?.step
            if (s) {
              if (Array.isArray(s.data)) {
                for (const d of s.data) {
                  edgeSteps.push({ ...s, data: d })
                }
              } else if (!edgeSteps.includes(s)) {
                edgeSteps.push(s)
              }
            }
          }
        }
      }
    }
    setPinnedEdge({ edgeId: id, steps: edgeSteps, position })
  }, [pinnedEdge, baseEdges])

  // Build step-to-edge mapping from edge data
  const edgeStepMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const edge of baseEdges) {
      const stepIndex = (edge.data as { stepIndex: number } | undefined)
        ?.stepIndex
      if (stepIndex !== undefined) {
        map.set(edge.id, stepIndex)
      }
    }
    return map
  }, [baseEdges])

  // Build a map from node id to node type for pixel coloring
  const nodeTypeMap = useMemo(() => {
    const map = new Map<string, { type: string; color?: string }>()
    for (const n of flow.flow.nodes) {
      map.set(n.id, { type: n.type ?? 'service', color: n.color })
    }
    return map
  }, [flow])

  const {
    fireManualPixel, removeManualPixel, setNodeStep,
    manualPixels, nodeProgress,
    activeNodes, destroyedNodes,
    ...animState
  } = useFlowAnimation(flow.flow.steps, edgeStepMap, playing, onCycleComplete, startFromStep)

  // Helper: check if a node is currently alive (static nodes always are, dynamic nodes need to be in activeNodes and not destroyed)
  const isNodeAlive = useCallback((nodeId: string) => {
    const node = baseNodes.find(n => n.id === nodeId)
    const isDynamic = node?.data?.isDynamic ?? false
    if (!isDynamic) return true
    return activeNodes.has(nodeId) && !destroyedNodes.has(nodeId)
  }, [baseNodes, activeNodes, destroyedNodes])

  // Report step changes to parent
  const onStepChangeRef = useRef(onStepChange)
  onStepChangeRef.current = onStepChange
  useEffect(() => {
    if (onStepChangeRef.current && animState.currentStepIndex >= 0) {
      onStepChangeRef.current(animState.currentStepIndex)
    }
  }, [animState.currentStepIndex])

  // Build a map: nodeId -> list of outgoing logical steps
  // A broadcast (to: [db, cache]) is ONE logical step with multiple edgeIds
  const nodeOutgoingSteps = useMemo(() => {
    const map = new Map<string, Array<{ stepIndex: number; step: FlowStep; edgeIds: string[] }>>()
    const { steps } = flow.flow
    for (let si = 0; si < steps.length; si++) {
      const step = steps[si]
      if (step.parallel) {
        for (const ps of step.parallel) {
          if (ps.from) {
            const entries = map.get(ps.from) ?? []
            const targets = Array.isArray(ps.to) ? ps.to : ps.to ? [ps.to] : []
            const edgeIds: string[] = []
            for (const t of targets) {
              const edgeId = baseEdges.find(
                (e) => e.source === ps.from && e.target === t && (e.data as { stepIndex: number } | undefined)?.stepIndex === si,
              )?.id
              if (edgeId) edgeIds.push(edgeId)
            }
            if (edgeIds.length > 0) entries.push({ stepIndex: si, step: ps, edgeIds })
            map.set(ps.from, entries)
          }
        }
      } else if (step.from) {
        const entries = map.get(step.from) ?? []
        const targets = Array.isArray(step.to) ? step.to : step.to ? [step.to] : []
        const edgeIds: string[] = []
        for (const t of targets) {
          const edgeId = baseEdges.find(
            (e) => e.source === step.from && e.target === t && (e.data as { stepIndex: number } | undefined)?.stepIndex === si,
          )?.id
          if (edgeId) edgeIds.push(edgeId)
        }
        if (edgeIds.length > 0) entries.push({ stepIndex: si, step, edgeIds })
        map.set(step.from, entries)
      }
    }
    return map
  }, [flow.flow, baseEdges])

  // Track which specific (nodeId, stepIndex) combos have a pixel in flight
  const activePixelSteps = useMemo(() => {
    const set = new Set<string>()
    for (const mp of manualPixels) {
      set.add(`${mp.sourceNodeId}:${mp.sourceStepIndex}`)
    }
    return set
  }, [manualPixels])

  // Auto-drilldown: when a step with drilldown:true is detected, capture the step index
  // and drill down after the pixel animation, preventing the parent from advancing further
  const drilldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastDrilldownStepRef = useRef<number>(-1)
  useEffect(() => {
    if (!onDrilldownStep) return
    const step = animState.activeStep
    if (!step) return
    if (!('drilldown' in step) || !step.drilldown) return
    const targetId = Array.isArray(step.to) ? step.to[0] : typeof step.to === 'string' ? step.to : null
    if (!targetId) return
    if (lastDrilldownStepRef.current === animState.currentStepIndex) return
    lastDrilldownStepRef.current = animState.currentStepIndex

    if (drilldownTimerRef.current) clearTimeout(drilldownTimerRef.current)

    // Capture the current step index NOW before the animation advances
    const capturedStepIndex = animState.currentStepIndex

    drilldownTimerRef.current = setTimeout(() => {
      // Pass both the target node and the step to resume from
      onDrilldownStep(targetId, capturedStepIndex)
      drilldownTimerRef.current = null
    }, 1500 / ((window as any).__flowSpeed ?? 1))
  }, [animState.activeStep, animState.currentStepIndex, onDrilldownStep])

  const handleNodeClick = useCallback((nodeId: string) => {
    const outgoing = nodeOutgoingSteps.get(nodeId)
    if (!outgoing || outgoing.length === 0) return

    let currentProg = nodeProgress.get(nodeId) ?? 0

    // If past the last step, reset progress and fire first step
    if (currentProg >= outgoing.length) {
      setNodeStep(nodeId, 0)
      currentProg = 0
    }

    // Block only if THIS EXACT logical step is already animating
    const stepKey = `${nodeId}:${currentProg}`
    if (activePixelSteps.has(stepKey)) return

    const entry = outgoing[currentProg]
    const sourceInfo = nodeTypeMap.get(nodeId) ?? { type: 'service' }

    // Increment progress once for this logical step
    setNodeStep(nodeId, currentProg + 1)

    // Fire a pixel for EACH edge in this logical step (broadcast = multiple edges)
    for (const edgeId of entry.edgeIds) {
      fireManualPixel({
        edgeId,
        step: entry.step,
        sourceNodeId: nodeId,
        sourceStepIndex: currentProg,
        sourceNodeType: sourceInfo.type,
        sourceNodeColor: sourceInfo.color,
      })
    }
  }, [nodeOutgoingSteps, nodeProgress, nodeTypeMap, fireManualPixel, setNodeStep, activePixelSteps])

  const handleProgressBarClick = useCallback((nodeId: string, targetStep: number) => {
    setNodeStep(nodeId, targetStep)
  }, [setNodeStep])

  // Apply active sender/receiver flags to nodes, and visibility for dynamic nodes
  const nodes: Node<FlowNodeData>[] = useMemo(() => {
    return baseNodes.map((node) => {
      const isDynamic = node.data?.isDynamic ?? false
      const isAlive = !isDynamic || (activeNodes.has(node.id) && !destroyedNodes.has(node.id))

      return {
        ...node,
        style: {
          ...node.style,
          opacity: isAlive ? 1 : 0,
          transition: 'opacity 0.4s ease',
          pointerEvents: (isAlive ? 'auto' : 'none') as React.CSSProperties['pointerEvents'],
        },
        data: {
          ...node.data,
          isActiveSender: animState.activeFromIds.has(node.id),
          isActiveReceiver: animState.activeToIds.has(node.id),
          currentStep: nodeProgress.get(node.id) ?? 0,
          outgoingStepCount: nodeOutgoingSteps.get(node.id)?.length ?? 0,
          onNodeClick: handleNodeClick,
          onProgressBarClick: handleProgressBarClick,
          onDrillDown,
        },
      }
    })
  }, [baseNodes, animState.activeFromIds, animState.activeToIds, nodeProgress, activeNodes, destroyedNodes, handleNodeClick, handleProgressBarClick, onDrillDown])

  // Highlight active edges, hide edges connected to hidden dynamic nodes
  const edges: Edge[] = useMemo(() => {
    return baseEdges.map((edge) => {
      const sourceAlive = isNodeAlive(edge.source)
      const targetAlive = isNodeAlive(edge.target)
      const bothAlive = sourceAlive && targetAlive

      if (animState.activeEdgeIds.has(edge.id)) {
        return {
          ...edge,
          style: {
            ...edge.style,
            stroke: '#4a9eff',
            strokeWidth: 4,
            opacity: bothAlive ? 1 : 0,
            transition: 'opacity 0.4s ease',
          },
          animated: true,
        }
      }
      return {
        ...edge,
        style: {
          ...edge.style,
          opacity: bothAlive ? 1 : 0,
          transition: 'opacity 0.4s ease',
        },
      }
    })
  }, [baseEdges, animState.activeEdgeIds, isNodeAlive])

  // Collect active edges for pixel rendering
  const activeEdges = useMemo(() => {
    if (!animState.activeStep) return []
    return baseEdges.filter((e) => animState.activeEdgeIds.has(e.id))
  }, [baseEdges, animState.activeEdgeIds, animState.activeStep])

  return (
    <div className="w-full h-full relative" ref={containerRef} aria-label="Flow canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_event, node) => handleNodeClick(node.id)}
        onEdgeClick={(event, edge) => {
          const edgeStep = (edge.data as { step?: FlowStep } | undefined)?.step
          if (!edgeStep) return
          handlePinPopup(edgeStep, { x: event.clientX, y: event.clientY }, edge.id)
        }}
        onPaneClick={() => setPinnedEdge(null)}
        nodesConnectable={false}
        edgesFocusable={false}
        nodesDraggable={false}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background gap={20} color="#1a1a2e" />
        <Controls
          showInteractive={false}
          style={{ background: '#1a1a2e', borderColor: '#2a2a4a' }}
        />
      </ReactFlow>

      {/* Data pixel overlay — automatic */}
      {animState.activeStep &&
        activeEdges.flatMap((edge) => {
          const sourceInfo = nodeTypeMap.get(edge.source) ?? {
            type: 'service',
          }
          // Use the sub-step if parallel, otherwise the main step
          const edgeStep =
            (edge.data as { step?: FlowStep } | undefined)?.step ??
            animState.activeStep!

          // If the step has array data, render one pixel per data object with stagger
          if (Array.isArray(edgeStep.data)) {
            return edgeStep.data.map((dataObj, i) => (
              <DataPixel
                key={`${edge.id}-${i}`}
                edgeId={edge.id}
                sourceNodeType={sourceInfo.type}
                sourceNodeColor={sourceInfo.color}
                step={edgeStep}
                containerRef={containerRef}
                onPixelClick={(s, pos) => handlePinPopup(s, pos, edge.id)}
                delayMs={i * 120}
                dataOverride={dataObj}
              />
            ))
          }

          return (
            <DataPixel
              key={edge.id}
              edgeId={edge.id}
              sourceNodeType={sourceInfo.type}
              sourceNodeColor={sourceInfo.color}
              step={edgeStep}
              containerRef={containerRef}
              onPixelClick={(s, pos) => handlePinPopup(s, pos, edge.id)}
            />
          )
        })}

      {/* Data pixel overlay — manual (click-to-fire) */}
      {manualPixels.map((mp) => (
        <DataPixel
          key={mp.id}
          edgeId={mp.edgeId}
          sourceNodeType={mp.sourceNodeType}
          sourceNodeColor={mp.sourceNodeColor}
          step={mp.step}
          containerRef={containerRef}
          isManual
          onAnimationComplete={() => removeManualPixel(mp.id)}
          onPixelClick={(s, pos) => handlePinPopup(s, pos, mp.edgeId)}
        />
      ))}

      {/* Pinned data popup — fixed position overlay */}
      {pinnedEdge && (
        <DataPopup
          steps={pinnedEdge.steps}
          position={pinnedEdge.position}
          onClose={() => setPinnedEdge(null)}
        />
      )}
    </div>
  )
}

export function FlowCanvas(props: FlowCanvasProps) {
  return <FlowCanvasInner key={JSON.stringify(props.flow.flow.nodes.map(n => n.id))} {...props} />
}
