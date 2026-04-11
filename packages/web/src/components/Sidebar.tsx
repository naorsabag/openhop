import { useState, useMemo, useCallback } from 'react'
import type { FlowListItem } from '../hooks/useFlowPolling'

interface TreeNode {
  name: string
  type: 'folder' | 'flow'
  flowId?: string
  children: TreeNode[]
  path: string // full path for folders, empty for root-level
}

function buildTree(flows: FlowListItem[]): TreeNode[] {
  const root: TreeNode[] = []
  for (const flow of flows) {
    const parts = flow.path ? flow.path.split('/') : []
    let current = root
    let currentPath = ''
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part
      let folder = current.find(n => n.type === 'folder' && n.name === part)
      if (!folder) {
        folder = { name: part, type: 'folder', children: [], path: currentPath }
        current.push(folder)
      }
      current = folder.children
    }
    current.push({
      name: flow.title,
      type: 'flow',
      flowId: flow.id,
      children: [],
      path: currentPath,
    })
  }
  return sortTree(root)
}

function sortTree(nodes: TreeNode[]): TreeNode[] {
  const folders = nodes.filter(n => n.type === 'folder').sort((a, b) => a.name.localeCompare(b.name))
  const flows = nodes.filter(n => n.type === 'flow').sort((a, b) => a.name.localeCompare(b.name))
  for (const folder of folders) {
    folder.children = sortTree(folder.children)
  }
  return [...folders, ...flows]
}

function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  const q = query.toLowerCase()
  const result: TreeNode[] = []
  for (const node of nodes) {
    if (node.type === 'flow') {
      if (node.name.toLowerCase().includes(q)) {
        result.push(node)
      }
    } else {
      // Folder: include if name matches or any children match
      const filteredChildren = filterTree(node.children, query)
      if (node.name.toLowerCase().includes(q) || filteredChildren.length > 0) {
        result.push({ ...node, children: filteredChildren.length > 0 ? filteredChildren : node.children })
      }
    }
  }
  return result
}

interface TreeItemProps {
  node: TreeNode
  depth: number
  selectedFlowId: string | null
  expandedFolders: Set<string>
  toggleFolder: (path: string) => void
  onSelectFlow: (id: string) => void
}

function TreeItem({ node, depth, selectedFlowId, expandedFolders, toggleFolder, onSelectFlow }: TreeItemProps) {
  if (node.type === 'folder') {
    const expanded = expandedFolders.has(node.path)
    return (
      <li role="treeitem" aria-expanded={expanded} data-testid={`folder-${node.path}`}>
        <button
          onClick={() => toggleFolder(node.path)}
          className="flex items-center gap-1.5 w-full text-left py-1 font-terminal text-sm text-text/70 hover:text-text transition-colors"
          style={{ paddingLeft: depth * 16 + 8 }}
        >
          <span className="shrink-0 text-xs" style={{ width: 16, textAlign: 'center' }}>
            {expanded ? '\u25BE' : '\u25B8'}
          </span>
          <span className="truncate">{node.name}</span>
        </button>
        {expanded && (
          <ul role="group">
            {node.children.map((child, i) => (
              <TreeItem
                key={child.type === 'flow' ? child.flowId : `${child.path}-${i}`}
                node={child}
                depth={depth + 1}
                selectedFlowId={selectedFlowId}
                expandedFolders={expandedFolders}
                toggleFolder={toggleFolder}
                onSelectFlow={onSelectFlow}
              />
            ))}
          </ul>
        )}
      </li>
    )
  }

  const isActive = node.flowId === selectedFlowId
  return (
    <li
      role="treeitem"
      aria-selected={isActive}
      data-testid={`sidebar-flow-${node.flowId}`}
    >
      <button
        onClick={() => node.flowId && onSelectFlow(node.flowId)}
        className="flex items-center gap-1.5 w-full text-left py-1 font-terminal text-sm transition-colors truncate"
        style={{
          paddingLeft: depth * 16 + 8,
          color: isActive ? '#7df9ff' : 'rgba(224, 224, 255, 0.6)',
          background: isActive ? 'rgba(125, 249, 255, 0.08)' : 'transparent',
        }}
      >
        <span className="shrink-0 text-xs" style={{ width: 16, textAlign: 'center', opacity: 0.5 }}>
          {'\u25C7'}
        </span>
        <span className="truncate">{node.name}</span>
      </button>
    </li>
  )
}

interface SidebarProps {
  flows: FlowListItem[]
  loading: boolean
  selectedFlowId: string | null
  onSelectFlow: (id: string | null) => void
}

export function Sidebar({ flows, loading, selectedFlowId, onSelectFlow }: SidebarProps) {
  const [search, setSearch] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set())

  const tree = useMemo(() => buildTree(flows), [flows])

  // Auto-expand all folders on first load
  useMemo(() => {
    if (flows.length > 0 && expandedFolders.size === 0) {
      const allPaths = new Set<string>()
      function collectPaths(nodes: TreeNode[]) {
        for (const n of nodes) {
          if (n.type === 'folder') {
            allPaths.add(n.path)
            collectPaths(n.children)
          }
        }
      }
      collectPaths(tree)
      if (allPaths.size > 0) {
        setExpandedFolders(allPaths)
      }
    }
  }, [flows, tree, expandedFolders.size])

  const displayTree = useMemo(() => {
    if (!search.trim()) return tree
    return filterTree(tree, search.trim())
  }, [tree, search])

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  const handleSelectFlow = useCallback((id: string) => {
    onSelectFlow(id)
  }, [onSelectFlow])

  return (
    <aside
      className="shrink-0 flex flex-col overflow-hidden"
      style={{ width: 260, background: '#141428', borderRight: '2px solid #2a2a4a' }}
      aria-label="File explorer"
    >
      {/* Search */}
      <div className="p-2 shrink-0" style={{ borderBottom: '1px solid #2a2a4a' }}>
        <input
          aria-label="Search flows"
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-2 py-1.5 rounded font-terminal text-xs text-text placeholder-text/30 outline-none focus:ring-1 focus:ring-accent"
          style={{ background: '#1a1a2e', border: '1px solid #2a2a4a' }}
        />
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <p className="text-text/40 font-terminal text-xs px-3 py-4">Loading...</p>
        ) : displayTree.length === 0 ? (
          <p className="text-text/40 font-terminal text-xs px-3 py-4">
            {search ? 'No matches' : 'No flows yet'}
          </p>
        ) : (
          <ul role="tree">
            {displayTree.map((node, i) => (
              <TreeItem
                key={node.type === 'flow' ? node.flowId : `${node.path}-${i}`}
                node={node}
                depth={0}
                selectedFlowId={selectedFlowId}
                expandedFolders={expandedFolders}
                toggleFolder={toggleFolder}
                onSelectFlow={handleSelectFlow}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
