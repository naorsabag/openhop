import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { loadStoredNodeTheme, storeNodeTheme, type NodeThemeId } from '../lib/node-themes'
import { NodeThemeContext } from './node-theme-context'

export function NodeThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<NodeThemeId>(() => loadStoredNodeTheme())

  const setThemeId = useCallback((id: NodeThemeId) => {
    setThemeIdState(id)
    storeNodeTheme(id)
  }, [])

  const value = useMemo(() => ({ themeId, setThemeId }), [themeId, setThemeId])

  return <NodeThemeContext.Provider value={value}>{children}</NodeThemeContext.Provider>
}
