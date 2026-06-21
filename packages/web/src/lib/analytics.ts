declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim()

/** GitHub Pages demo only — local `npm run dev` and CLI deploys omit the ID. */
export function initAnalytics(): void {
  if (!MEASUREMENT_ID) return
  if (import.meta.env.VITE_FRAGMENT_MODE !== '1') return

  window.dataLayer = window.dataLayer ?? []
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args)
  }
  window.gtag('js', new Date())
  window.gtag('config', MEASUREMENT_ID, { send_page_view: false })

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`
  script.onload = () => trackPageView()
  document.head.appendChild(script)

  window.addEventListener('hashchange', trackPageView)
  trackPageView()
}

export function trackPageView(): void {
  if (!MEASUREMENT_ID || !window.gtag) return
  const page_path = `${window.location.pathname}${window.location.search}${window.location.hash}`
  window.gtag('event', 'page_view', {
    page_path,
    page_location: window.location.href,
    page_title: document.title,
  })
}

export {}
