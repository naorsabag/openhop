import { NODE_THEME_IDS, NODE_THEME_LABELS } from '../lib/node-themes'
import { useNodeTheme } from '../context/node-theme-context'

export function ThemeToggle() {
  const { themeId, setThemeId } = useNodeTheme()

  return (
    <div
      role="group"
      aria-label="Node theme"
      className="inline-flex rounded border overflow-hidden"
      style={{ borderColor: '#1a4a22' }}
    >
      {NODE_THEME_IDS.map((id) => {
        const active = themeId === id
        return (
          <button
            key={id}
            type="button"
            data-testid={`theme-${id}`}
            aria-pressed={active}
            onClick={() => setThemeId(id)}
            className="openhop-header-btn font-pixel text-xs px-2.5 py-1 transition-colors"
            style={{
              fontSize: 10,
              background: active ? '#1a4a22' : 'transparent',
              color: active ? '#7fff7f' : '#6b9b6b',
              border: 'none',
              borderRight: id === 'pixel' ? '1px solid #1a4a22' : undefined,
            }}
          >
            {NODE_THEME_LABELS[id]}
          </button>
        )
      })}
    </div>
  )
}
