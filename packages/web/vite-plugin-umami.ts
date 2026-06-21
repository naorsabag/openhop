import type { Plugin } from 'vite'

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
}

/** Inject Umami into index.html <head> for the GitHub Pages (fragment-mode) build only. */
export function umamiHeadTag(): Plugin {
  return {
    name: 'umami-head-tag',
    transformIndexHtml(html) {
      const websiteId = process.env.VITE_UMAMI_WEBSITE_ID?.trim()
      if (process.env.VITE_FRAGMENT_MODE !== '1' || !websiteId) return html

      const scriptUrl =
        process.env.VITE_UMAMI_SCRIPT_URL?.trim() || 'https://cloud.umami.is/script.js'
      const tag =
        `<script defer src="${escapeHtmlAttr(scriptUrl)}" ` +
        `data-website-id="${escapeHtmlAttr(websiteId)}"></script>`

      return html.replace('</head>', `    ${tag}\n  </head>`)
    },
  }
}
