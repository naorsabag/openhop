import { isUmamiEnabled } from './umami-gating.ts'

let skipNextHashChange = false

/** Update the hash without counting a Umami page view (e.g. Save syncing the URL bar). */
export function setHashWithoutUmamiPageView(hash: string): void {
  skipNextHashChange = true
  window.location.hash = hash
}

/** Track the current URL when hash changed without firing hashchange (autoload). */
export function trackPageViewIfEnabled(): void {
  if (!isUmamiEnabled(import.meta.env)) return
  whenUmamiReady(trackPageView)
}

export function initUmamiHashTracking(): void {
  if (!isUmamiEnabled(import.meta.env)) return

  window.addEventListener('hashchange', () => {
    if (skipNextHashChange) {
      skipNextHashChange = false
      return
    }
    trackPageView()
  })

  whenUmamiReady(() => {
    const hash = window.location.hash
    if (!hash || hash === '#') return
    trackPageView()
  })
}

function whenUmamiReady(callback: () => void): void {
  if (window.umami?.track) {
    callback()
    return
  }

  const started = Date.now()
  const tick = (): void => {
    if (window.umami?.track) {
      callback()
      return
    }
    if (Date.now() - started > 10_000) return
    window.setTimeout(tick, 50)
  }
  window.setTimeout(tick, 0)
}

export function trackPageView(): void {
  if (!window.umami?.track) return
  window.umami.track((props) => ({
    ...props,
    url: `${window.location.pathname}${window.location.search}${window.location.hash}`,
  }))
}
