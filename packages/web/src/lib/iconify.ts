/**
 * Iconify CDN helpers — same source as FlowNode custom service overlays
 * (`https://api.iconify.design/{prefix}/{name}.svg`).
 */

/** Default Iconify icon per node type. Pick graphical icons — avoid text glyphs like `mdi:api`. */
export const NODE_TYPE_ICON: Record<string, string> = {
  actor: 'mdi:account-circle',
  endpoint: 'mdi:access-point-network',
  auth: 'mdi:shield-lock',
  database: 'mdi:database',
  external: 'mdi:cloud-outline',
  cache: 'logos:redis',
  queue: 'mdi:message-arrow-outline',
  service: 'mdi:hexagon-multiple-outline',
  docker: 'logos:docker-icon',
  k8s: 'logos:kubernetes',
  scheduler: 'mdi:calendar-clock',
  ai_agent: 'mdi:robot-outline',
  browser: 'logos:chrome',
  transform: 'mdi:swap-horizontal',
  validation: 'mdi:shield-check',
  custom: 'mdi:shape-outline',
}

/** @deprecated use NODE_TYPE_ICON */
export const CORPORATE_TYPE_ICON = NODE_TYPE_ICON

/** Iconify sets that ship with their own colors — skip ?color= recoloring. */
const COLORFUL_ICON_PREFIXES = new Set(['logos', 'twemoji', 'emojione', 'noto', 'fluent-emoji'])

const ICONIFY_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isIconifyId(icon: string | undefined): boolean {
  return !!icon && ICONIFY_ID_PATTERN.test(icon)
}

/** Build an Iconify SVG URL. Pass `recolor` to tint monotone icons (e.g. white on dark canvas). */
export function iconifySvgUrl(icon: string, recolor?: string): string {
  const [prefix, name] = icon.split(':')
  const base = `https://api.iconify.design/${prefix}/${name}.svg`
  if (!recolor) return base
  const [iconPrefix] = icon.split(':')
  if (COLORFUL_ICON_PREFIXES.has(iconPrefix)) return base
  const hex = recolor.replace('#', '')
  return `${base}?color=%23${hex}`
}

/** Node's explicit `icon` wins; otherwise fall back to the type default. */
export function resolveNodeTypeIcon(nodeType: string, customIcon?: string): string {
  if (customIcon && isIconifyId(customIcon)) return customIcon
  return NODE_TYPE_ICON[nodeType] ?? NODE_TYPE_ICON.service
}

/** @deprecated use resolveNodeTypeIcon */
export const resolveCorporateNodeIcon = resolveNodeTypeIcon
