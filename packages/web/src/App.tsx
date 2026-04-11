import { useState } from 'react'
import { FlowCanvas } from './components/FlowCanvas'
import { exampleFlow } from './data/example-flow'

function App() {
  const [playing, setPlaying] = useState(false)

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
          onClick={() => setPlaying((p) => !p)}
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
          className="shrink-0 p-4 flex flex-col gap-3"
          style={{ width: 240, background: '#141428', borderRight: '2px solid #2a2a4a' }}
          aria-label="Sidebar"
        >
          <h2 className="font-pixel text-text/60" style={{ fontSize: 10 }}>
            Flows
          </h2>
          <div
            className="font-terminal text-text text-lg truncate"
            title={exampleFlow.meta.title}
          >
            {exampleFlow.meta.title}
          </div>
          {exampleFlow.meta.description && (
            <p className="font-terminal text-text/40 text-sm">
              {exampleFlow.meta.description}
            </p>
          )}
        </aside>

        {/* Canvas */}
        <main className="flex-1 min-w-0" style={{ background: '#0a0a1a' }}>
          <FlowCanvas flow={exampleFlow} playing={playing} />
        </main>
      </div>
    </div>
  )
}

export default App
