import { useState, useEffect, useRef, useCallback } from 'react'
import type { Flow } from '../types'

const API_BASE = '' // proxy handles /api -> localhost:8787

export interface FlowListItem {
  id: string
  title: string
  description?: string
  path?: string
  version: number
  updatedAt: string
}

export function useFlowList() {
  const [flows, setFlows] = useState<FlowListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  // `reload()` bumps `tick`, which retriggers the fetch effect. Mutations
  // (create / delete) call this to refresh the sidebar without remounting.
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    // AbortController cancels the previous in-flight fetch when `reload()`
    // bumps `tick`. Without it, two overlapping /api/flows requests can
    // resolve out of order and a stale response can overwrite the fresh
    // post-mutation list — putting just-deleted flows back in the sidebar.
    const controller = new AbortController()
    fetch(`${API_BASE}/api/flows`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        setFlows(data)
        setLoading(false)
      })
      .catch((err) => {
        // AbortError means a newer reload superseded us — leave state alone.
        if (err instanceof DOMException && err.name === 'AbortError') return
        setLoading(false)
      })
    return () => controller.abort()
  }, [tick])

  return { flows, loading, reload }
}

export function useFlowData(flowId: string | null) {
  const [flow, setFlow] = useState<Flow | null>(null)
  const [loading, setLoading] = useState(false)
  const versionRef = useRef(0)

  // Fetch the full flow when flowId changes
  useEffect(() => {
    if (!flowId) {
      setFlow(null)
      return
    }
    setLoading(true)
    fetch(`${API_BASE}/api/flows/${flowId}`)
      .then((r) => r.json())
      .then((data) => {
        setFlow({ meta: data.meta, flow: data.flow }) // StoredFlow has { id, meta, flow, version, ... }
        versionRef.current = data.version
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [flowId])

  // Poll for version changes every 500ms
  useEffect(() => {
    if (!flowId) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/flows/${flowId}/version`)
        const { version } = await res.json()
        if (version > versionRef.current) {
          // Version changed — re-fetch full flow
          const fullRes = await fetch(`${API_BASE}/api/flows/${flowId}`)
          const data = await fullRes.json()
          setFlow({ meta: data.meta, flow: data.flow })
          versionRef.current = data.version
        }
      } catch {
        // Network or JSON parse failure — keep last-good state, retry on next tick.
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [flowId])

  return { flow, loading }
}
