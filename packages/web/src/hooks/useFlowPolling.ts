import { useState, useEffect, useRef } from 'react'
import type { Flow } from '../types'

const API_BASE = '' // proxy handles /api -> localhost:8787

interface FlowListItem {
  id: string
  title: string
  description?: string
  tags: string[]
  version: number
  updatedAt: string
}

export function useFlowList() {
  const [flows, setFlows] = useState<FlowListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE}/api/flows`)
      .then(r => r.json())
      .then(data => { setFlows(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return { flows, loading }
}

export function useFlowData(flowId: string | null) {
  const [flow, setFlow] = useState<Flow | null>(null)
  const [loading, setLoading] = useState(false)
  const versionRef = useRef(0)

  // Fetch the full flow when flowId changes
  useEffect(() => {
    if (!flowId) { setFlow(null); return }
    setLoading(true)
    fetch(`${API_BASE}/api/flows/${flowId}`)
      .then(r => r.json())
      .then(data => {
        setFlow(data.flow) // StoredFlow has { id, flow, version, ... }
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
          setFlow(data.flow)
          versionRef.current = data.version
        }
      } catch {}
    }, 500)
    return () => clearInterval(interval)
  }, [flowId])

  return { flow, loading }
}
