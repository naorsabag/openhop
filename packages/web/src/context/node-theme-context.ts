import { createContext, useContext } from 'react'
import type { NodeThemeId } from '../lib/node-themes'

export interface NodeThemeContextValue {
  themeId: NodeThemeId
  setThemeId: (id: NodeThemeId) => void
}

export const NodeThemeContext = createContext<NodeThemeContextValue | null>(null)

export function useNodeTheme(): NodeThemeContextValue {
  const context = useContext(NodeThemeContext)
  if (!context) throw new Error('useNodeTheme must be used within NodeThemeProvider')
  return context
}
