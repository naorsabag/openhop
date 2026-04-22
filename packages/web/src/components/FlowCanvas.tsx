import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useReactFlow,
  type NodeTypes,
  type EdgeTypes,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import { FlowNodeComponent, type FlowNodeData } from './nodes/FlowNode'
import { RoadEdge } from './edges/RoadEdge'
import { useFlowAnimation, type EdgeFlowRef, type StepEdgeMapping } from '../hooks/useFlowAnimation'
import { useFlowGraphLayout } from '../hooks/useFlowGraphLayout'
import { DataPixel } from './DataPixel'
import { DataPopup } from './DataPopup'
import type { Flow, FlowStep } from '../types'

const nodeTypes: NodeTypes = {
  flowNode: FlowNodeComponent,
}

const edgeTypes: EdgeTypes = {
  road: RoadEdge,
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
const getTargets = (to: string | string[] | undefined) => (Array.isArray(to) ? to : to ? [to] : [])

interface FlowCanvasProps {
  flow: Flow
  playing: boolean
  onDrillDown?: (nodeId: string) => void
  onDrilldownStep?: (nodeId: string, atStepIndex: number) => void
  onCycleComplete?: () => void
  startFromStep?: number
  onStepChange?: (stepIndex: number) => void
  onInspectStep?: (step: FlowStep) => void
}

/** Inner component that can use useReactFlow (needs ReactFlowProvider context) */
function FlowCanvasInner({ flow, playing, onDrillDown, onDrilldownStep, onCycleComplete, startFromStep, onStepChange, onInspectStep }: FlowCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const flowSteps = useMemo(() => flow.flow.steps ?? [], [flow.flow.steps])
  const [pinnedEdge, setPinnedEdge] = useState<{
    edgeId: string
    steps: FlowStep[]
    position: { x: number; y: number }
  } | null>(null)

  const { nodes: baseNodes, edges: baseEdges } = useFlowGraphLayout(flow)
  const reactFlow = useReactFlow()

  // Re-fit the view whenever node positions change. ELK arrives asynchronously
  // after the initial fallback layout, so the built-in `fitView` prop's single
  // on-mount run lands on the fallback; this effect catches subsequent updates
  // (and drill-down flow swaps).
  const layoutKey = useMemo(
    () => baseNodes.map(n => `${n.id}@${n.position.x},${n.position.y}`).join('|'),
    [baseNodes],
  )
  useEffect(() => {
    if (baseNodes.length === 0) return
    const fit = () => {
      const pane = document.querySelector('.react-flow') as HTMLElement | null
      if (!pane) return
      const paneW = pane.offsetWidth
      const paneH = pane.offsetHeight
      if (paneW === 0 || paneH === 0) return
      const xs = baseNodes.map(n => n.position.x)
      const ys = baseNodes.map(n => n.position.y)
      const w = baseNodes[0].width ?? 108
      const h = baseNodes[0].height ?? 160
      const minX = Math.min(...xs)
      const minY = Math.min(...ys)
      const maxX = Math.max(...xs) + w
      const maxY = Math.max(...ys) + h
      const contentW = maxX - minX
      const contentH = maxY - minY
      const pad = 0.3
      const zoom = Math.min(paneW / (contentW * (1 + pad)), paneH / (contentH * (1 + pad)), 1.5)
      const centerX = (minX + maxX) / 2
      const centerY = (minY + maxY) / 2
      const x = paneW / 2 - centerX * zoom
      const y = paneH / 2 - centerY * zoom
      reactFlow.setViewport({ x, y, zoom })
    }
    const t1 = setTimeout(fit, 50)
    const t2 = setTimeout(fit, 400)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [layoutKey, reactFlow]) // eslint-disable-line react-hooks/exhaustive-deps

  const pairEdgeMap = useMemo(() => {
    const map = new Map<string, Edge>()
    for (const edge of baseEdges) {
      map.set(pairKey(edge.source, edge.target), edge)
    }
    return map
  }, [baseEdges])

  const resolveEdgeFlow = useCallback((fromId: string, toId: string, step: FlowStep): EdgeFlowRef | null => {
    const edge = pairEdgeMap.get(pairKey(fromId, toId))
    if (!edge) return null

    return {
      edgeId: edge.id,
      fromId,
      toId,
      reverse: edge.source !== fromId || edge.target !== toId,
      step,
    }
  }, [pairEdgeMap])

  const stepMappings = useMemo<StepEdgeMapping[]>(() => {
    return flowSteps.map((step, stepIndex) => {
      const edgeFlows: EdgeFlowRef[] = []
      const fromIds: string[] = []
      const toIds: string[] = []
      const parallel = 'parallel' in step ? step.parallel : undefined

      if (parallel) {
        for (const ps of parallel) {
          if (ps.from) fromIds.push(ps.from)
          if (ps.to) {
            const targets = getTargets(ps.to)
            toIds.push(...targets)
            for (const target of targets) {
              if (!ps.from) continue
              const edgeFlow = resolveEdgeFlow(ps.from, target, ps)
              if (edgeFlow) edgeFlows.push(edgeFlow)
            }
          }
        }
      } else {
        const from = 'from' in step ? step.from : undefined
        if (from) fromIds.push(from)
        if ('to' in step) {
          const targets = getTargets(step.to)
          toIds.push(...targets)
          for (const target of targets) {
            if (!from) continue
            const edgeFlow = resolveEdgeFlow(from, target, step)
            if (edgeFlow) edgeFlows.push(edgeFlow)
          }
        }
      }

      return { stepIndex, edgeFlows, fromIds, toIds, step }
    })
  }, [flowSteps, resolveEdgeFlow])

  const edgeStepsById = useMemo(() => {
    const map = new Map<string, FlowStep[]>()

    const pushStep = (edgeId: string, step: FlowStep) => {
      const steps = map.get(edgeId) ?? []
      if (!steps.includes(step)) steps.push(step)
      map.set(edgeId, steps)
    }

    for (const mapping of stepMappings) {
      for (const edgeFlow of mapping.edgeFlows) {
        pushStep(edgeFlow.edgeId, edgeFlow.step)
      }
    }

    return map
  }, [stepMappings])

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
      const relatedSteps = edgeStepsById.get(id) ?? []
      for (const relatedStep of relatedSteps) {
        if (relatedStep === step) continue
        if (Array.isArray(relatedStep.data)) {
          for (const d of relatedStep.data) {
            edgeSteps.push({ ...relatedStep, data: d })
          }
        } else {
          edgeSteps.push(relatedStep)
        }
      }
    }
    setPinnedEdge({ edgeId: id, steps: edgeSteps, position })
  }, [pinnedEdge, edgeStepsById])

  // Build a map from node id to node type for pixel coloring
  const nodeTypeMap = useMemo(() => {
    const map = new Map<string, { type: string; color?: string }>()
    for (const n of flow.flow.nodes) {
      map.set(n.id, { type: n.type ?? 'service', color: n.color })
    }
    return map
  }, [flow])

  const {
    fireManualPixel, removeManualPixel, setNodeStep, activateNode, deactivateNode,
    manualPixels, nodeProgress,
    activeNodes, destroyedNodes,
    ...animState
  } = useFlowAnimation(flowSteps, stepMappings, playing, onCycleComplete, startFromStep)

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
  // A broadcast (to: [db, cache]) is ONE logical step with multiple edge flows.
  const nodeOutgoingSteps = useMemo(() => {
    const map = new Map<string, Array<{ stepIndex: number; step: FlowStep; edgeFlows: EdgeFlowRef[] }>>()
    const steps = flowSteps
    for (let si = 0; si < steps.length; si++) {
      const step = steps[si]
      const parallel = 'parallel' in step ? step.parallel : undefined
      const destroy = 'destroy' in step ? step.destroy : undefined
      const create = 'create' in step ? step.create : undefined
      const from = 'from' in step ? step.from : undefined

      if (parallel) {
        for (const ps of parallel) {
          if (ps.from) {
            const entries = map.get(ps.from) ?? []
            const targets = getTargets(ps.to)
            const edgeFlows: EdgeFlowRef[] = []
            for (const t of targets) {
              const edgeFlow = resolveEdgeFlow(ps.from, t, ps)
              if (edgeFlow) edgeFlows.push(edgeFlow)
            }
            if (edgeFlows.length > 0) entries.push({ stepIndex: si, step: ps, edgeFlows })
            map.set(ps.from, entries)
          }
        }
      } else if (destroy) {
        // Destroy step: outgoing action for the destroyed node (no edge, just triggers deactivation)
        const entries = map.get(destroy) ?? []
        entries.push({ stepIndex: si, step, edgeFlows: [] })
        map.set(destroy, entries)
      } else if (create && from) {
        // Create step: from → newly created node
        const entries = map.get(from) ?? []
        const edgeFlow = resolveEdgeFlow(from, create, step)
        if (edgeFlow) entries.push({ stepIndex: si, step, edgeFlows: [edgeFlow] })
        map.set(from, entries)
      } else if (from) {
        const entries = map.get(from) ?? []
        const targets = 'to' in step ? getTargets(step.to) : []
        const edgeFlows: EdgeFlowRef[] = []
        for (const t of targets) {
          const edgeFlow = resolveEdgeFlow(from, t, step)
          if (edgeFlow) edgeFlows.push(edgeFlow)
        }
        if (edgeFlows.length > 0) entries.push({ stepIndex: si, step, edgeFlows })
        map.set(from, entries)
      }
    }
    return map
  }, [flowSteps, resolveEdgeFlow])

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

    onInspectStep?.(entry.step)

    // Increment progress once for this logical step
    setNodeStep(nodeId, currentProg + 1)

    // If this is a create step, activate the new node
    if (entry.step.create) {
      activateNode(entry.step.create)
    }

    // If this is a destroy step, deactivate the node
    if (entry.step.destroy) {
      deactivateNode(entry.step.destroy)
      return // no pixel to fire
    }

    // Fire a pixel for EACH edge flow in this logical step (broadcast = multiple edges)
    for (const edgeFlow of entry.edgeFlows) {
      fireManualPixel({
        edgeId: edgeFlow.edgeId,
        reverse: edgeFlow.reverse,
        step: edgeFlow.step,
        sourceNodeId: nodeId,
        sourceStepIndex: currentProg,
        sourceNodeType: sourceInfo.type,
        sourceNodeColor: sourceInfo.color,
      })
    }
  }, [nodeOutgoingSteps, nodeProgress, nodeTypeMap, fireManualPixel, setNodeStep, activePixelSteps, activateNode, deactivateNode, onInspectStep])

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

  const edges: Edge[] = useMemo(() => {
    return baseEdges
      .filter((edge) => isNodeAlive(edge.source) && isNodeAlive(edge.target))
      .map((edge) => {
      const sourceAlive = isNodeAlive(edge.source)
      const targetAlive = isNodeAlive(edge.target)
      const bothAlive = sourceAlive && targetAlive
      const isActive = animState.activeEdgeIds.has(edge.id)

      return {
        ...edge,
        interactionWidth: undefined,
        style: {
          ...edge.style,
          opacity: 1,
          pointerEvents: 'auto' as any,
          transition: 'opacity 0.4s ease',
        },
        data: {
          ...edge.data,
          active: isActive,
          visible: bothAlive,
        },
      }
      })
  }, [baseEdges, animState.activeEdgeIds, isNodeAlive])

  // Collect active edges for pixel rendering
  const activeEdgeFlows = useMemo(() => {
    if (!animState.activeStep) return []
    return animState.activeEdgeFlows
  }, [animState.activeEdgeFlows, animState.activeStep])

  return (
    <div className="w-full h-full relative" ref={containerRef} aria-label="Flow canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={(_event, node) => handleNodeClick(node.id)}
        onPaneClick={() => setPinnedEdge(null)}
        nodesConnectable={false}
        edgesFocusable={false}
        nodesDraggable={false}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.1}
        maxZoom={6}
      >
        <Background variant={'lines' as any} gap={32} size={1} color="#1F3E2F" />
        <Controls
          showInteractive={false}
          style={{ background: '#0d2612', borderColor: '#1a4a22' }}
        />
      </ReactFlow>

      {/* Data pixel overlay — automatic */}
      {animState.activeStep &&
        activeEdgeFlows.flatMap((edgeFlow, edgeFlowIndex) => {
          const sourceInfo = nodeTypeMap.get(edgeFlow.fromId) ?? {
            type: 'service',
          }
          const edgeStep = edgeFlow.step ?? animState.activeStep!

          // If the step has array data, render one pixel per data object with stagger
          if (Array.isArray(edgeStep.data)) {
            return edgeStep.data.map((dataObj, dataIndex) => (
              <DataPixel
                key={`${edgeFlow.edgeId}-${edgeFlow.reverse ? 'r' : 'f'}-${edgeFlowIndex}-${dataIndex}`}
                edgeId={edgeFlow.edgeId}
                reverse={edgeFlow.reverse}
                sourceNodeType={sourceInfo.type}
                sourceNodeColor={sourceInfo.color}
                step={edgeStep}
                containerRef={containerRef}
                onPixelClick={(s, pos) => handlePinPopup(s, pos, edgeFlow.edgeId)}
                delayMs={dataIndex * 120}
                dataOverride={dataObj}
              />
            ))
          }

          return (
            <DataPixel
              key={`${edgeFlow.edgeId}-${edgeFlow.reverse ? 'r' : 'f'}-${edgeFlowIndex}`}
              edgeId={edgeFlow.edgeId}
              reverse={edgeFlow.reverse}
              sourceNodeType={sourceInfo.type}
              sourceNodeColor={sourceInfo.color}
              step={edgeStep}
              containerRef={containerRef}
              onPixelClick={(s, pos) => handlePinPopup(s, pos, edgeFlow.edgeId)}
            />
          )
        })}

      {/* Data pixel overlay — manual (click-to-fire) */}
      {manualPixels.map((mp) => (
        <DataPixel
          key={mp.id}
          edgeId={mp.edgeId}
          reverse={mp.reverse}
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
  return (
    <ReactFlowProvider>
      <FlowCanvasInner key={JSON.stringify(props.flow.flow.nodes.map(n => n.id))} {...props} />
    </ReactFlowProvider>
  )
}
