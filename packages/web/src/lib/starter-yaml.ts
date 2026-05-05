/**
 * Starter YAML for "+ New flow" / "+ New folder" actions in the sidebar.
 *
 * Lives in lib/ rather than next to FlowEditorModal so the modal file can
 * keep a clean component-only export shape — exporting non-component
 * helpers from a component file trips `react-refresh/only-export-components`
 * and breaks Vite's fast refresh.
 */

const STARTER_YAML = `meta:
  title: New flow
flow:
  nodes:
    - id: browser
      label: Browser
      type: actor
    - id: api
      label: API
      type: endpoint
  steps:
    - from: browser
      to: api
      data: request
    - from: api
      to: browser
      data: response
`

/**
 * Build the seed YAML for a "New flow" inside a given folder path. When no
 * path is supplied the flow lands at the workspace root.
 *
 * `\s{2}` (instead of two literal spaces) sidesteps the `no-regex-spaces`
 * lint rule and reads as deliberate two-space indent matching.
 */
export function buildStarterYaml(path?: string): string {
  if (!path) return STARTER_YAML
  return STARTER_YAML.replace(
    /^meta:\n\s{2}title: New flow\n/,
    `meta:\n  title: New flow\n  path: ${path}\n`
  )
}

export { STARTER_YAML }
