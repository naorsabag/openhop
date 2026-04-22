import { useEffect, useMemo, useState } from 'react'
import type { Flow } from '../types'
import {
  buildFlowTopology,
  buildReactFlowGraph,
  computeElkLayout,
  computeFallbackPositions,
} from '../lib/flow-layout'

export function useFlowGraphLayout(flow: Flow) {
  const topology = useMemo(() => buildFlowTopology(flow), [flow])

  const fallbackGraph = useMemo(() => {
    const fallbackPositions = computeFallbackPositions(topology)
    return buildReactFlowGraph(topology, fallbackPositions)
  }, [topology])

  // Start empty so React Flow renders nothing until ELK finishes — prevents
  // the visible flicker from the fallback column layout.
  const empty = useMemo(() => ({ nodes: [], edges: [] as typeof fallbackGraph.edges }), [])
  const [graph, setGraph] = useState<typeof fallbackGraph>(empty as typeof fallbackGraph)

  useEffect(() => {
    setGraph(empty as typeof fallbackGraph)
  }, [fallbackGraph, empty])

  useEffect(() => {
    let cancelled = false

    void computeElkLayout(topology)
      .then(({ positions, routes, portAssignments }) => {
        if (cancelled) return
        setGraph(buildReactFlowGraph(topology, positions, routes, portAssignments))
      })
      .catch(() => {
        if (cancelled) return
        setGraph(fallbackGraph) // fall back only if ELK errors
      })

    return () => {
      cancelled = true
    }
  }, [topology, fallbackGraph])

  return graph
}
