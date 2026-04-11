import { useState } from 'react'
import { FlowCanvas } from './components/FlowCanvas'
import { useFlowList, useFlowData } from './hooks/useFlowPolling'
import { exampleFlow } from './data/example-flow'

function App() {
  const [playing, setPlaying] = useState(false)
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null)
  const { flows, loading: listLoading } = useFlowList()
  const { flow: apiFlow, loading: flowLoading } = useFlowData(selectedFlowId)

  // Use API flow if selected, otherwise fall back to hardcoded example
  const flow = apiFlow ?? exampleFlow

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{ background: '#1a1a2e', borderBottom: '2px solid #2a2a4a' }}
      >
        <h1 className="font-pixel text-accent" style={{ fontSize: 14 }}>
          FlowScope
        </h1>
        <button
          aria-label={playing ? 'Pause flow' : 'Play flow'}
          onClick={() => setPlaying(p => !p)}
          className="font-pixel text-xs px-3 py-1 border border-border text-text hover:text-accent hover:border-accent transition-colors"
          style={{ fontSize: 10 }}
        >
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside
          className="shrink-0 p-4 flex flex-col gap-3 overflow-y-auto"
          style={{ width: 240, background: '#141428', borderRight: '2px solid #2a2a4a' }}
          aria-label="Sidebar"
        >
          <h2 className="font-pixel text-text/60" style={{ fontSize: 10 }}>
            Flows
          </h2>

          {/* API flows */}
          {listLoading ? (
            <p className="text-text/40 text-sm font-terminal">Loading...</p>
          ) : flows.length > 0 ? (
            flows.map(f => (
              <button
                key={f.id}
                onClick={() => { setSelectedFlowId(f.id); setPlaying(false) }}
                aria-label={`Flow: ${f.title}`}
                className="text-left w-full"
              >
                <div className={`font-terminal text-lg truncate ${selectedFlowId === f.id ? 'text-accent' : 'text-text'}`}>
                  {f.title}
                </div>
                {f.description && (
                  <p className="font-terminal text-text/40 text-sm truncate">{f.description}</p>
                )}
                {f.tags && f.tags.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {f.tags.map(t => (
                      <span key={t} className="font-terminal text-xs px-1 border border-border text-text/50">{t}</span>
                    ))}
                  </div>
                )}
              </button>
            ))
          ) : null}

          {/* Hardcoded example (always shown as fallback) */}
          <button
            onClick={() => { setSelectedFlowId(null); setPlaying(false) }}
            aria-label="Flow: Create Order (example)"
            className="text-left w-full"
          >
            <div className={`font-terminal text-lg truncate ${selectedFlowId === null ? 'text-accent' : 'text-text'}`}>
              {exampleFlow.meta.title} (example)
            </div>
            {exampleFlow.meta.description && (
              <p className="font-terminal text-text/40 text-sm truncate">{exampleFlow.meta.description}</p>
            )}
          </button>
        </aside>

        {/* Canvas */}
        <main className="flex-1 min-w-0" style={{ background: '#0a0a1a' }}>
          {flowLoading ? (
            <div className="w-full h-full flex items-center justify-center text-text/40 font-terminal">
              Loading flow...
            </div>
          ) : (
            <FlowCanvas flow={flow} playing={playing} />
          )}
        </main>
      </div>
    </div>
  )
}

export default App
