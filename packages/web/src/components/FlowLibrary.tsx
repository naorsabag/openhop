import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFlowList } from '../hooks/useFlowPolling'
import type { FlowListItem } from '../hooks/useFlowPolling'

function FlowCard({ flow }: { flow: FlowListItem }) {
  const navigate = useNavigate()

  return (
    <button
      data-testid={`flow-card-${flow.id}`}
      aria-label={`Flow: ${flow.title}`}
      onClick={() => navigate(`/flow/${flow.id}`)}
      className="text-left w-full rounded-lg p-5 transition-all hover:scale-[1.02] hover:shadow-lg cursor-pointer"
      style={{
        background: '#1a1a2e',
        border: '1px solid #2a2a4a',
      }}
    >
      <h3
        className="font-pixel text-accent truncate mb-2"
        style={{ fontSize: 14 }}
      >
        {flow.title}
      </h3>

      {flow.description && (
        <p
          className="font-terminal text-text/60 text-sm mb-3"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {flow.description}
        </p>
      )}

      {flow.tags && flow.tags.length > 0 && (
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {flow.tags.map((t) => (
            <span
              key={t}
              className="font-terminal text-xs px-2 py-0.5 rounded"
              style={{
                background: '#2a2a4a',
                color: 'rgba(224, 224, 255, 0.7)',
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 text-xs font-terminal text-text/40">
        {flow.updatedAt && (
          <span>
            Updated{' '}
            {new Date(flow.updatedAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        )}
        <span>v{flow.version}</span>
      </div>
    </button>
  )
}

export function FlowLibrary() {
  const { flows, loading } = useFlowList()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return flows
    const q = search.toLowerCase()
    return flows.filter(
      (f) =>
        f.title.toLowerCase().includes(q) ||
        (f.description ?? '').toLowerCase().includes(q) ||
        f.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }, [flows, search])

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden"
      style={{ background: '#0a0a1a' }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4 shrink-0"
        style={{ background: '#1a1a2e', borderBottom: '2px solid #2a2a4a' }}
      >
        <h1 className="font-pixel text-accent" style={{ fontSize: 16 }}>
          FlowScope
        </h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Search */}
        <div className="max-w-3xl mx-auto mb-6">
          <input
            aria-label="Search flows"
            type="text"
            placeholder="Search flows by title, description, or tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg font-terminal text-sm text-text placeholder-text/30 outline-none focus:ring-1 focus:ring-accent"
            style={{
              background: '#1a1a2e',
              border: '1px solid #2a2a4a',
            }}
          />
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-text/40 font-terminal text-sm">
              Loading flows...
            </p>
          </div>
        ) : filtered.length > 0 ? (
          <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((f) => (
              <FlowCard key={f.id} flow={f} />
            ))}
          </div>
        ) : flows.length > 0 ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-text/40 font-terminal text-sm">
              No flows matching "{search}"
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-center py-20">
            <p className="text-text/40 font-terminal text-sm">
              No flows yet. Push a flow with the API to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
