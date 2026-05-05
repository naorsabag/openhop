import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AppFragment from './AppFragment.tsx'

// `VITE_FRAGMENT_MODE=1` switches the bundle into the GitHub Pages variant:
// no API server, flows live in the URL fragment, "Save" copies a share URL.
// Set in .github/workflows/pages.yml; unset for `npm run dev` and the
// docker-compose / openhop CLI deploys.
const FRAGMENT_MODE = import.meta.env.VITE_FRAGMENT_MODE === '1'
const Root = FRAGMENT_MODE ? AppFragment : App

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
)
