import { ReactFlow, Background, Controls, type NodeTypes } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useMemo } from 'react'
import { FlowNodeComponent } from './nodes/FlowNode'
import { flowToGraph } from '../lib/flow-to-graph'
import type { Flow } from '../types'

const nodeTypes: NodeTypes = {
  flowNode: FlowNodeComponent,
}

interface FlowCanvasProps {
  flow: Flow
}

export function FlowCanvas({ flow }: FlowCanvasProps) {
  const { nodes, edges } = useMemo(() => flowToGraph(flow), [flow])

  return (
    <div className="w-full h-full" aria-label="Flow canvas">
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
    </div>
  )
}
