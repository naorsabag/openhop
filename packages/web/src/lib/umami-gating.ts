/** Pages-only Umami gate — used by vite-plugin-umami.ts (build) and umami.ts (runtime). */
export function isUmamiEnabled(env: {
  VITE_FRAGMENT_MODE?: string
  VITE_UMAMI_WEBSITE_ID?: string
}): boolean {
  return env.VITE_FRAGMENT_MODE === '1' && Boolean(env.VITE_UMAMI_WEBSITE_ID?.trim())
}
