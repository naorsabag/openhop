import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  loadStoredNodeTheme,
  storeNodeTheme,
  type NodeThemeId,
} from '../lib/node-themes'

interface NodeThemeContextValue {
  themeId: NodeThemeId
  setThemeId: (id: NodeThemeId) => void
}

const NodeThemeContext = createContext<NodeThemeContextValue | null>(null)

export function NodeThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<NodeThemeId>(() => loadStoredNodeTheme())

  const setThemeId = useCallback((id: NodeThemeId) => {
    setThemeIdState(id)
    storeNodeTheme(id)
  }, [])

  const value = useMemo(() => ({ themeId, setThemeId }), [themeId, setThemeId])

  return <NodeThemeContext.Provider value={value}>{children}</NodeThemeContext.Provider>
}

export function useNodeTheme(): NodeThemeContextValue {
  const ctx = useContext(NodeThemeContext)
  if (!ctx) throw new Error('useNodeTheme must be used within NodeThemeProvider')
  return ctx
}
