import type { Flow } from '../types'
import {
  buildFlowTopology,
  buildReactFlowGraph,
  computeFallbackPositions,
} from './flow-layout'

export { buildFlowTopology, buildReactFlowGraph, computeFallbackPositions } from './flow-layout'

export function flowToGraph(flow: Flow) {
  const topology = buildFlowTopology(flow)
  const positions = computeFallbackPositions(topology)
  return buildReactFlowGraph(topology, positions)
}
