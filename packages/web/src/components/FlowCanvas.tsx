import {
  ReactFlow,
  Background,
  Controls,
  type NodeTypes,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useMemo, useRef } from 'react'
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

  const animState = useFlowAnimation(flow.flow.steps, edgeStepMap, playing)

  // Apply active sender/receiver flags to nodes
  const nodes: Node<FlowNodeData>[] = useMemo(() => {
    return baseNodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        isActiveSender: animState.activeFromIds.has(node.id),
        isActiveReceiver: animState.activeToIds.has(node.id),
      },
    }))
  }, [baseNodes, animState.activeFromIds, animState.activeToIds])

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

      {/* Data pixel overlay */}
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
    </div>
  )
}

export function FlowCanvas(props: FlowCanvasProps) {
  return <FlowCanvasInner {...props} />
}
