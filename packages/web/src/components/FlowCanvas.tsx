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
}

/** Inner component that can use useReactFlow (needs ReactFlowProvider context) */
function FlowCanvasInner({ flow, playing }: FlowCanvasProps) {
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

  // Build a map: nodeId -> list of outgoing steps (stepIndex + edge info)
  const nodeOutgoingSteps = useMemo(() => {
    const map = new Map<string, Array<{ stepIndex: number; step: FlowStep; edgeId: string }>>()
    const { steps } = flow.flow
    for (let si = 0; si < steps.length; si++) {
      const step = steps[si]
      if (step.parallel) {
        for (const ps of step.parallel) {
          if (ps.from) {
            const entries = map.get(ps.from) ?? []
            // Find matching edge
            const targets = Array.isArray(ps.to) ? ps.to : ps.to ? [ps.to] : []
            for (const t of targets) {
              const edgeId = baseEdges.find(
                (e) => e.source === ps.from && e.target === t && (e.data as { stepIndex: number } | undefined)?.stepIndex === si,
              )?.id
              if (edgeId) entries.push({ stepIndex: si, step: ps, edgeId })
            }
            map.set(ps.from, entries)
          }
        }
      } else if (step.from) {
        const entries = map.get(step.from) ?? []
        const targets = Array.isArray(step.to) ? step.to : step.to ? [step.to] : []
        for (const t of targets) {
          const edgeId = baseEdges.find(
            (e) => e.source === step.from && e.target === t && (e.data as { stepIndex: number } | undefined)?.stepIndex === si,
          )?.id
          if (edgeId) entries.push({ stepIndex: si, step, edgeId })
        }
        map.set(step.from, entries)
      }
    }
    return map
  }, [flow.flow, baseEdges])

  // Track which nodes currently have a manual pixel in flight
  const activeManualNodes = useMemo(() => {
    const ids = new Set<string>()
    for (const mp of manualPixels) {
      if (mp.step.from) ids.add(mp.step.from)
    }
    return ids
  }, [manualPixels])

  const handleNodeClick = useCallback((nodeId: string) => {
    // Don't fire if this node already has a manual pixel in flight
    if (activeManualNodes.has(nodeId)) return
    // Don't fire if this node is currently the active sender in auto-play
    if (animState.activeFromIds.has(nodeId)) return

    const outgoing = nodeOutgoingSteps.get(nodeId)
    if (!outgoing || outgoing.length === 0) return

    const currentProg = nodeProgress.get(nodeId) ?? 0

    // If past the last step, reset to 0
    if (currentProg >= outgoing.length) {
      setNodeStep(nodeId, 0)
      return
    }

    const entry = outgoing[currentProg]

    const sourceInfo = nodeTypeMap.get(nodeId) ?? { type: 'service' }
    fireManualPixel({
      edgeId: entry.edgeId,
      step: entry.step,
      sourceNodeType: sourceInfo.type,
      sourceNodeColor: sourceInfo.color,
    })
  }, [nodeOutgoingSteps, nodeProgress, nodeTypeMap, fireManualPixel, activeManualNodes, animState.activeFromIds, setNodeStep])

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
        onNodeClick: handleNodeClick,
        onProgressBarClick: handleProgressBarClick,
      },
    }))
  }, [baseNodes, animState.activeFromIds, animState.activeToIds, nodeProgress, handleNodeClick, handleProgressBarClick])

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
  return <FlowCanvasInner {...props} />
}
