import type { Plugin } from 'vite'
import { isUmamiEnabled } from './src/lib/umami-gating.ts'

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/\$/g, '&#36;')
}

/** Inject Umami into index.html <head> for the GitHub Pages (fragment-mode) build only. */
export function umamiHeadTag(): Plugin {
  return {
    name: 'umami-head-tag',
    transformIndexHtml(html) {
      if (!isUmamiEnabled(process.env)) return html

      const websiteId = process.env.VITE_UMAMI_WEBSITE_ID!.trim()
      const scriptUrl =
        process.env.VITE_UMAMI_SCRIPT_URL?.trim() || 'https://cloud.umami.is/script.js'
      const tag =
        `<script defer src="${escapeHtmlAttr(scriptUrl)}" ` +
        `data-website-id="${escapeHtmlAttr(websiteId)}" data-auto-track="false"></script>`

      const closeHead = '</head>'
      const idx = html.indexOf(closeHead)
      if (idx === -1) {
        console.warn('[umami-head-tag] index.html missing </head>; Umami script not injected.')
        return html
      }

      return html.slice(0, idx) + `    ${tag}\n  ${closeHead}` + html.slice(idx + closeHead.length)
    },
  }
}
