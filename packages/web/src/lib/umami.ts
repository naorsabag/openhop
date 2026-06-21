declare global {
  interface Window {
    umami?: {
      track: (
        event?: string | ((props: Record<string, unknown>) => Record<string, unknown>)
      ) => void
    }
  }
}

const WEBSITE_ID = import.meta.env.VITE_UMAMI_WEBSITE_ID?.trim()
const SCRIPT_URL =
  import.meta.env.VITE_UMAMI_SCRIPT_URL?.trim() || 'https://cloud.umami.is/script.js'

/** GitHub Pages demo only — local `npm run dev` and CLI deploys omit the website ID. */
export function initUmami(): void {
  if (!WEBSITE_ID) return
  if (import.meta.env.VITE_FRAGMENT_MODE !== '1') return

  const script = document.createElement('script')
  script.defer = true
  script.src = SCRIPT_URL
  script.dataset.websiteId = WEBSITE_ID
  script.onload = () => {
    window.addEventListener('hashchange', trackPageView)
  }
  document.head.appendChild(script)
}

/** Hash-routed flow links don't fire a full navigation — track them manually. */
export function trackPageView(): void {
  if (!WEBSITE_ID || !window.umami?.track) return
  window.umami.track((props) => ({
    ...props,
    url: `${window.location.pathname}${window.location.search}${window.location.hash}`,
  }))
}

export {}
