import LZString from 'lz-string'

/**
 * URL-fragment encoding for the GitHub Pages deploy.
 *
 * The static deploy has no API, so a flow's full YAML lives in the URL hash:
 *   https://naorsabag.github.io/OpenHop/#<lz-uri-encoded>
 *
 * `compressToEncodedURIComponent` is the LZ variant designed for URLs — its
 * output is already safe to drop straight into a hash without further encoding.
 * Decompresses to `null` on bad input (truncated link, foreign payload, etc.),
 * which the app surfaces as a "share link looks corrupted" banner.
 */

export function encodeFragment(yamlText: string): string {
  return LZString.compressToEncodedURIComponent(yamlText)
}

export function decodeFragment(fragment: string): string | null {
  if (!fragment) return null
  try {
    const out = LZString.decompressFromEncodedURIComponent(fragment)
    return out && out.length > 0 ? out : null
  } catch {
    return null
  }
}

/**
 * Build the full sharable URL for a flow's YAML. Uses Vite's `BASE_URL` so the
 * Pages deploy at `/OpenHop/` and dev at `/` both produce correct links.
 */
export function buildShareUrl(yamlText: string, origin: string, baseUrl: string): string {
  const fragment = encodeFragment(yamlText)
  // baseUrl ends with '/' (Vite convention), so concat without normalization.
  return `${origin}${baseUrl}#${fragment}`
}
