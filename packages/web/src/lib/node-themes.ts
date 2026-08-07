/**
 * Node + data-pixel visual themes. Canvas chrome (background, edges, labels)
 * stays unchanged — only sprite/pixel rendering switches.
 */

export type NodeThemeId = 'pixel' | 'corporate'

export const NODE_THEME_IDS: readonly NodeThemeId[] = ['pixel', 'corporate']

export const NODE_THEME_STORAGE_KEY = 'openhop-node-theme'

export interface NodeThemePalette {
  /** CSS filter for sprite hue cycling (pixel theme); undefined = use accent color directly. */
  variantFilters: readonly (string | undefined)[]
  variantAccents: readonly string[]
}

/** Current pixel-art palette — hue-rotate filters + neon accents. */
export const PIXEL_THEME_PALETTE: NodeThemePalette = {
  variantFilters: [
    undefined,
    'hue-rotate(210deg)',
    'hue-rotate(90deg)',
    'hue-rotate(140deg)',
    'hue-rotate(320deg)',
  ],
  variantAccents: ['#ff8a4a', '#b47aff', '#4aff7a', '#4a9eff', '#ff6b6b'],
}

/** Muted corporate palette — flat accent colors, no sprite filters. */
export const CORPORATE_THEME_PALETTE: NodeThemePalette = {
  variantFilters: [undefined, undefined, undefined, undefined, undefined],
  variantAccents: ['#2563eb', '#475569', '#0d9488', '#1d4ed8', '#64748b'],
}

export const NODE_THEME_PALETTES: Record<NodeThemeId, NodeThemePalette> = {
  pixel: PIXEL_THEME_PALETTE,
  corporate: CORPORATE_THEME_PALETTE,
}

export const NODE_THEME_LABELS: Record<NodeThemeId, string> = {
  pixel: 'Pixel',
  corporate: 'Corporate',
}

export function getNodeThemePalette(themeId: NodeThemeId): NodeThemePalette {
  return NODE_THEME_PALETTES[themeId]
}

export function parseNodeThemeId(raw: string | null | undefined): NodeThemeId {
  return raw === 'corporate' ? 'corporate' : 'pixel'
}

export function loadStoredNodeTheme(): NodeThemeId {
  try {
    return parseNodeThemeId(localStorage.getItem(NODE_THEME_STORAGE_KEY))
  } catch {
    return 'pixel'
  }
}

export function storeNodeTheme(themeId: NodeThemeId): void {
  try {
    localStorage.setItem(NODE_THEME_STORAGE_KEY, themeId)
  } catch {
    // ignore quota / private mode
  }
}

/** Short type badge for corporate node boxes. */
export const CORPORATE_TYPE_BADGE: Record<string, string> = {
  actor: 'USR',
  endpoint: 'API',
  auth: 'AUTH',
  database: 'DB',
  external: 'EXT',
  cache: 'CACHE',
  queue: 'QUEUE',
  service: 'SVC',
  docker: 'DKR',
  k8s: 'K8S',
  scheduler: 'CRON',
  ai_agent: 'AI',
  browser: 'WEB',
  transform: 'XFORM',
  validation: 'VALID',
  custom: 'NODE',
}

export function corporateTypeBadge(nodeType: string): string {
  const derived = nodeType.slice(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '')
  return CORPORATE_TYPE_BADGE[nodeType] ?? (derived || 'NODE')
}
