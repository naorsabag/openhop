import { useCallback, useState } from 'react'

const API_BASE = '' // proxy handles /api -> localhost:8787

export interface CreateFlowResult {
  id: string
  title: string
  version: number
}

export interface ServerErrorDetail {
  path: string
  message: string
  suggestion?: string
}

export interface MutationError {
  /** "validation" mirrors the CLI: server rejected the YAML. */
  kind: 'validation' | 'server' | 'network'
  status?: number
  message: string
  details?: ServerErrorDetail[]
}

interface MutationState {
  inFlight: boolean
  error: MutationError | null
}

/**
 * Mutation hook for create / delete. POSTs raw YAML so the server hits the same
 * code path as `openhop push` (single source of truth for validation messages).
 */
export function useFlowMutations() {
  const [state, setState] = useState<MutationState>({ inFlight: false, error: null })

  const reset = useCallback(() => {
    setState({ inFlight: false, error: null })
  }, [])

  const createFlow = useCallback(async (yamlText: string): Promise<CreateFlowResult | null> => {
    setState({ inFlight: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/api/flows`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/yaml' },
        body: yamlText,
      })
      if (!res.ok) {
        let details: ServerErrorDetail[] | undefined
        try {
          const body = (await res.json()) as { details?: ServerErrorDetail[] }
          details = body.details
        } catch {
          /* fall through with empty details */
        }
        const err: MutationError =
          res.status === 400
            ? { kind: 'validation', status: 400, message: 'Server rejected the flow', details }
            : { kind: 'server', status: res.status, message: `HTTP ${res.status}`, details }
        setState({ inFlight: false, error: err })
        return null
      }
      const data = (await res.json()) as CreateFlowResult
      setState({ inFlight: false, error: null })
      return data
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setState({ inFlight: false, error: { kind: 'network', message } })
      return null
    }
  }, [])

  const deleteFlow = useCallback(async (flowId: string): Promise<boolean> => {
    setState({ inFlight: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/api/flows/${flowId}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 404) {
        setState({
          inFlight: false,
          error: { kind: 'server', status: res.status, message: `HTTP ${res.status}` },
        })
        return false
      }
      // 404 is treated as success — already gone.
      setState({ inFlight: false, error: null })
      return true
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setState({ inFlight: false, error: { kind: 'network', message } })
      return false
    }
  }, [])

  return { ...state, createFlow, deleteFlow, reset }
}
