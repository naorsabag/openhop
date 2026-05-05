import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
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
      let folder = current.find((n) => n.type === 'folder' && n.name === part)
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
  const folders = nodes
    .filter((n) => n.type === 'folder')
    .sort((a, b) => a.name.localeCompare(b.name))
  const flows = nodes.filter((n) => n.type === 'flow').sort((a, b) => a.name.localeCompare(b.name))
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
        result.push({
          ...node,
          children: filteredChildren.length > 0 ? filteredChildren : node.children,
        })
      }
    }
  }
  return result
}

interface AddMenuState {
  /** Full folder path for which the menu is open. `''` represents the root. `null` = closed. */
  openForPath: string | null
  setOpenForPath: (path: string | null) => void
}

interface AddMenuProps {
  parentPath: string // '' for root
  onClose: () => void
  onCreateAt: (kind: 'flow' | 'folder', parentPath: string) => void
}

function AddMenu({ parentPath, onClose, onCreateAt }: AddMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null)

  // Close on outside click / Esc.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    // Defer the click listener until next tick so the click that opened the
    // menu (which bubbles up to document) doesn't immediately close it.
    const t = setTimeout(() => document.addEventListener('mousedown', onDoc), 0)
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      role="menu"
      data-testid={`add-menu-${parentPath}`}
      className="absolute z-20 font-terminal text-xs flex flex-col"
      style={{
        right: 8,
        top: 'calc(100% + 2px)',
        background: '#1a1a2e',
        border: '1px solid #2a2a4a',
        borderRadius: 4,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
        minWidth: 130,
      }}
    >
      <button
        role="menuitem"
        data-testid={`add-menu-${parentPath}-flow`}
        onClick={() => {
          onCreateAt('flow', parentPath)
          onClose()
        }}
        className="text-left px-3 py-2 hover:bg-white/5 transition-colors"
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(224, 224, 255, 0.85)',
          cursor: 'pointer',
        }}
      >
        📄 New flow
      </button>
      <button
        role="menuitem"
        data-testid={`add-menu-${parentPath}-folder`}
        onClick={() => {
          onCreateAt('folder', parentPath)
          onClose()
        }}
        className="text-left px-3 py-2 hover:bg-white/5 transition-colors"
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(224, 224, 255, 0.85)',
          cursor: 'pointer',
          borderTop: '1px solid #2a2a4a',
        }}
      >
        📁 New folder
      </button>
    </div>
  )
}

interface TreeItemProps {
  node: TreeNode
  depth: number
  selectedFlowId: string | null
  expandedFolders: Set<string>
  toggleFolder: (path: string) => void
  onSelectFlow: (id: string) => void
  onEditFlow?: (id: string) => void
  onDeleteFlow?: (id: string) => void
  onCreateAt?: (kind: 'flow' | 'folder', parentPath: string) => void
  addMenu?: AddMenuState
}

function TreeItem({
  node,
  depth,
  selectedFlowId,
  expandedFolders,
  toggleFolder,
  onSelectFlow,
  onEditFlow,
  onDeleteFlow,
  onCreateAt,
  addMenu,
}: TreeItemProps) {
  if (node.type === 'folder') {
    const expanded = expandedFolders.has(node.path)
    const showAddBtn = !!onCreateAt
    const menuOpen = addMenu?.openForPath === node.path
    // Wrap the header in its own .group/folder.relative so hover and absolute
    // positioning scope to just the folder header row, not the entire expanded
    // subtree (which includes child <ul>). Without this, "top: 50%" on the
    // "+" button lands at the geometric center of the whole subtree, and
    // hovering a child flow row triggers the parent folder's group-hover.
    return (
      <li role="treeitem" aria-expanded={expanded} data-testid={`folder-${node.path}`}>
        <div className="group/folder relative">
          <button
            onClick={() => toggleFolder(node.path)}
            className="flex items-center gap-1.5 w-full text-left py-1 font-terminal text-sm text-text/70 hover:text-text transition-colors pr-7"
            style={{ paddingLeft: depth * 16 + 8, cursor: 'pointer' }}
          >
            <span className="shrink-0 text-xs" style={{ width: 16, textAlign: 'center' }}>
              {expanded ? '\u25BE' : '\u25B8'}
            </span>
            <span className="truncate">{node.name}</span>
          </button>
          {showAddBtn && (
            <button
              aria-label={`Add inside ${node.name}`}
              data-testid={`sidebar-add-${node.path}`}
              onClick={(e) => {
                e.stopPropagation()
                addMenu?.setOpenForPath(menuOpen ? null : node.path)
              }}
              title="Add (flow or folder)"
              className={`absolute right-2 top-1/2 -translate-y-1/2 font-pixel transition-opacity ${
                menuOpen
                  ? 'opacity-100'
                  : 'opacity-0 group-hover/folder:opacity-100 focus:opacity-100'
              }`}
              style={{
                background: 'transparent',
                border: 'none',
                color: menuOpen ? '#7df9ff' : 'rgba(224, 224, 255, 0.7)',
                cursor: 'pointer',
                padding: '0 4px',
                fontSize: 14,
                lineHeight: 1,
              }}
            >
              {'+'}
            </button>
          )}
          {menuOpen && onCreateAt && (
            <AddMenu
              parentPath={node.path}
              onClose={() => addMenu?.setOpenForPath(null)}
              onCreateAt={onCreateAt}
            />
          )}
        </div>
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
                onEditFlow={onEditFlow}
                onDeleteFlow={onDeleteFlow}
                onCreateAt={onCreateAt}
                addMenu={addMenu}
              />
            ))}
          </ul>
        )}
      </li>
    )
  }

  const isActive = node.flowId === selectedFlowId
  const flowId = node.flowId
  return (
    <li
      role="treeitem"
      aria-selected={isActive}
      data-testid={`sidebar-flow-${flowId}`}
      className="group/flow relative"
    >
      <button
        onClick={() => flowId && onSelectFlow(flowId)}
        className="flex items-center gap-1.5 w-full text-left py-1 font-terminal text-sm transition-colors truncate pr-12"
        style={{
          paddingLeft: depth * 16 + 8,
          color: isActive ? '#7df9ff' : 'rgba(224, 224, 255, 0.6)',
          background: isActive ? 'rgba(125, 249, 255, 0.08)' : 'transparent',
          cursor: 'pointer',
        }}
      >
        <span className="shrink-0 text-xs" style={{ width: 16, textAlign: 'center', opacity: 0.5 }}>
          {'\u25C7'}
        </span>
        <span className="truncate">{node.name}</span>
      </button>
      {flowId && (onEditFlow || onDeleteFlow) && (
        <div
          className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover/flow:opacity-100 focus-within:opacity-100 transition-opacity"
          style={{ pointerEvents: 'auto' }}
        >
          {onEditFlow && (
            <button
              aria-label={`Edit ${node.name}`}
              data-testid={`sidebar-edit-${flowId}`}
              onClick={(e) => {
                e.stopPropagation()
                onEditFlow(flowId)
              }}
              title="Edit (E)"
              className="font-pixel text-xs hover:text-accent transition-colors"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(224, 224, 255, 0.5)',
                cursor: 'pointer',
                padding: '0 4px',
                fontSize: 11,
              }}
            >
              {'\u270E'}
            </button>
          )}
          {onDeleteFlow && (
            <button
              aria-label={`Delete ${node.name}`}
              data-testid={`sidebar-delete-${flowId}`}
              onClick={(e) => {
                e.stopPropagation()
                onDeleteFlow(flowId)
              }}
              title="Delete"
              className="font-pixel text-xs hover:text-red-400 transition-colors"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(224, 224, 255, 0.5)',
                cursor: 'pointer',
                padding: '0 4px',
                fontSize: 11,
              }}
            >
              {'\u2715'}
            </button>
          )}
        </div>
      )}
    </li>
  )
}

interface SidebarProps {
  flows: FlowListItem[]
  loading: boolean
  selectedFlowId: string | null
  onSelectFlow: (id: string | null) => void
  /** parentPath is `''` for root, or the folder path for nested creation. */
  onCreateAt?: (kind: 'flow' | 'folder', parentPath: string) => void
  onEditFlow?: (id: string) => void
  onDeleteFlow?: (id: string) => void
}

export function Sidebar({
  flows,
  loading,
  selectedFlowId,
  onSelectFlow,
  onCreateAt,
  onEditFlow,
  onDeleteFlow,
}: SidebarProps) {
  const [addMenuPath, setAddMenuPath] = useState<string | null>(null)
  const addMenu: AddMenuState = useMemo(
    () => ({ openForPath: addMenuPath, setOpenForPath: setAddMenuPath }),
    [addMenuPath]
  )
  const [search, setSearch] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set())

  const tree = useMemo(() => buildTree(flows), [flows])

  // Auto-expand all folders the first time flows arrive.
  const hasAutoExpanded = useRef(false)
  useEffect(() => {
    if (hasAutoExpanded.current) return
    if (flows.length === 0) return
    const allPaths = new Set<string>()
    const collectPaths = (nodes: TreeNode[]) => {
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
      hasAutoExpanded.current = true
    }
  }, [flows, tree])

  const displayTree = useMemo(() => {
    if (!search.trim()) return tree
    return filterTree(tree, search.trim())
  }, [tree, search])

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  const handleSelectFlow = useCallback(
    (id: string) => {
      onSelectFlow(id)
    },
    [onSelectFlow]
  )

  return (
    <aside
      className="shrink-0 flex flex-col overflow-hidden"
      style={{ width: 260, background: '#141428', borderRight: '2px solid #2a2a4a' }}
      aria-label="File explorer"
    >
      {/* Search + root-level "+" */}
      <div
        className="p-2 shrink-0 flex items-center gap-2 relative"
        style={{ borderBottom: '1px solid #2a2a4a' }}
      >
        <input
          aria-label="Search flows"
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-2 py-1.5 rounded font-terminal text-xs text-text placeholder-text/30 outline-none focus:ring-1 focus:ring-accent"
          style={{ background: '#1a1a2e', border: '1px solid #2a2a4a' }}
        />
        {onCreateAt && (
          <>
            <button
              aria-label="Add at root"
              data-testid="sidebar-add-root"
              onClick={() => setAddMenuPath(addMenuPath === '' ? null : '')}
              title="Add (flow or folder)"
              className="font-pixel text-sm transition-colors"
              style={{
                background: 'transparent',
                border: '1px solid #2a2a4a',
                borderRadius: 4,
                color: addMenuPath === '' ? '#7df9ff' : 'rgba(224, 224, 255, 0.7)',
                cursor: 'pointer',
                padding: '2px 8px',
                lineHeight: 1.2,
              }}
            >
              {'+'}
            </button>
            {addMenuPath === '' && (
              <AddMenu parentPath="" onClose={() => setAddMenuPath(null)} onCreateAt={onCreateAt} />
            )}
          </>
        )}
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
                onEditFlow={onEditFlow}
                onDeleteFlow={onDeleteFlow}
                onCreateAt={onCreateAt}
                addMenu={addMenu}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
