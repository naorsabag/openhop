import LZString from 'lz-string'
import { deflateSync, inflateSync } from 'fflate'
import YAML from 'yaml'

/**
 * URL-fragment encoding for the GitHub Pages deploy.
 *
 * The static deploy has no API, so a flow's full YAML lives in the URL hash:
 *   https://naorsabag.github.io/openhop/#<encoded>
 *
 * Two on-the-wire formats coexist; the leading byte(s) of the fragment tell
 * the decoder which one to use:
 *
 *   ~1<base64url>  — version 1: YAML parsed + restringified with minimal
 *                    indentation (drops comments/whitespace), DEFLATE-raw
 *                    compressed, base64url-encoded. ~30-50% shorter than v0.
 *   <anything>     — legacy: lz-string's URL-safe variant of the raw YAML.
 *
 * `~` is outside lz-string's output alphabet
 * (`[A-Za-z0-9$_-]`), so the version prefix is unambiguous and old share
 * URLs in the wild keep working.
 *
 * Bad input (truncated link, foreign payload, etc.) round-trips to `null`,
 * which the app surfaces as a "share link looks corrupted" banner.
 */

const V1_PREFIX = '~1'

function bytesToBase64Url(bytes: Uint8Array): string {
  // btoa() needs a binary string, not a Uint8Array.
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(input: string): Uint8Array {
  let s = input.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4 !== 0) s += '='
  const binary = atob(s)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

/**
 * Drop comments and re-emit with 1-space indent + no line wrapping. Reduces
 * the byte count fed to DEFLATE by ~20-40% on the bundled example flows.
 * Falls through to the raw text if the input doesn't parse (the editor may
 * call us mid-keystroke on invalid YAML).
 */
function minifyYaml(yamlText: string): string {
  try {
    const parsed = YAML.parse(yamlText)
    if (parsed === undefined) return yamlText
    return YAML.stringify(parsed, { indent: 1, lineWidth: 0, minContentWidth: 0 })
  } catch {
    return yamlText
  }
}

export function encodeFragment(yamlText: string): string {
  const minified = minifyYaml(yamlText)
  const compressed = deflateSync(new TextEncoder().encode(minified), { level: 9 })
  return V1_PREFIX + bytesToBase64Url(compressed)
}

export function decodeFragment(fragment: string): string | null {
  if (!fragment) return null
  if (fragment.startsWith(V1_PREFIX)) {
    try {
      const bytes = base64UrlToBytes(fragment.slice(V1_PREFIX.length))
      const out = new TextDecoder().decode(inflateSync(bytes))
      return out.length > 0 ? out : null
    } catch {
      return null
    }
  }
  // Legacy v0 — lz-string of the raw YAML. Keeps old share URLs working.
  try {
    const out = LZString.decompressFromEncodedURIComponent(fragment)
    return out && out.length > 0 ? out : null
  } catch {
    return null
  }
}

/**
 * Build the full sharable URL for a flow's YAML. Uses Vite's `BASE_URL` so the
 * Pages deploy at `/openhop/` and dev at `/` both produce correct links.
 */
export function buildShareUrl(yamlText: string, origin: string, baseUrl: string): string {
  const fragment = encodeFragment(yamlText)
  // baseUrl ends with '/' (Vite convention), so concat without normalization.
  return `${origin}${baseUrl}#${fragment}`
}
