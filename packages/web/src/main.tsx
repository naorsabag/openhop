import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AppFragment from './AppFragment.tsx'
import { initAnalytics } from './lib/analytics.ts'

initAnalytics()

// `VITE_FRAGMENT_MODE=1` switches the bundle into the GitHub Pages variant:
// no API server, flows live in the URL fragment, "Save" copies a share URL.
// Set in .github/workflows/pages.yml; unset for `npm run dev` and the
// docker-compose / openhop CLI deploys. Inlined in JSX (vs a named `Root`
// const) so we don't trip react-refresh/only-export-components — Fast
// Refresh requires component-shaped consts to be exported, and main.tsx
// is the entry point that shouldn't export.
createRoot(document.getElementById('root')!).render(
  <StrictMode>{import.meta.env.VITE_FRAGMENT_MODE === '1' ? <AppFragment /> : <App />}</StrictMode>
)
