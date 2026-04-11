import {
  ReactFlow,
  Background,
  Controls,
  type NodeTypes,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useMemo, useRef, useCallback } from 'react'
import { FlowNodeComponent, type FlowNodeData } from './nodes/FlowNode'
import { flowToGraph } from '../lib/flow-to-graph'
import { useFlowAnimation } from '../hooks/useFlowAnimation'
import { DataPixel } from './DataPixel'
import type { Flow, FlowStep } from '../types'

const nodeTypes: NodeTypes = {
  flowNode: FlowNodeComponent,
}

interface FlowCanvasProps {
  flow: Flow
  playing: boolean
  onDrillDown?: (nodeId: string) => void
}

/** Inner component that can use useReactFlow (needs ReactFlowProvider context) */
function FlowCanvasInner({ flow, playing, onDrillDown }: FlowCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const { nodes: baseNodes, edges: baseEdges } = useMemo(
    () => flowToGraph(flow),
    [flow],
  )

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
    ...animState
  } = useFlowAnimation(flow.flow.steps, edgeStepMap, playing)

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

  // Apply active sender/receiver flags to nodes
  const nodes: Node<FlowNodeData>[] = useMemo(() => {
    return baseNodes.map((node) => ({
      ...node,
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
    }))
  }, [baseNodes, animState.activeFromIds, animState.activeToIds, nodeProgress, handleNodeClick, handleProgressBarClick, onDrillDown])

  // Highlight active edges
  const edges: Edge[] = useMemo(() => {
    return baseEdges.map((edge) => {
      if (animState.activeEdgeIds.has(edge.id)) {
        return {
          ...edge,
          style: {
            ...edge.style,
            stroke: '#4a9eff',
            strokeWidth: 4,
          },
          animated: true,
        }
      }
      return edge
    })
  }, [baseEdges, animState.activeEdgeIds])

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
        activeEdges.map((edge) => {
          const sourceInfo = nodeTypeMap.get(edge.source) ?? {
            type: 'service',
          }
          // Use the sub-step if parallel, otherwise the main step
          const edgeStep =
            (edge.data as { step?: FlowStep } | undefined)?.step ??
            animState.activeStep!
          return (
            <DataPixel
              key={edge.id}
              edgeId={edge.id}
              sourceNodeType={sourceInfo.type}
              sourceNodeColor={sourceInfo.color}
              step={edgeStep}
              containerRef={containerRef}
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
        />
      ))}
    </div>
  )
}

export function FlowCanvas(props: FlowCanvasProps) {
  return <FlowCanvasInner key={JSON.stringify(props.flow.flow.nodes.map(n => n.id))} {...props} />
}
