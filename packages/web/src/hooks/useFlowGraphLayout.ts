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

  const [graph, setGraph] = useState(fallbackGraph)

  useEffect(() => {
    setGraph(fallbackGraph)
  }, [fallbackGraph])

  useEffect(() => {
    let cancelled = false

    void computeElkLayout(topology)
      .then(({ positions, routes, portAssignments }) => {
        if (cancelled) return
        setGraph(buildReactFlowGraph(topology, positions, routes, portAssignments))
      })
      .catch(() => {
        if (cancelled) return
        setGraph(fallbackGraph)
      })

    return () => {
      cancelled = true
    }
  }, [topology, fallbackGraph])

  return graph
}
