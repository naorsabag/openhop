// TODO: Import these types from @flowscope/shared instead of re-defining.
// Currently duplicated because the shared package uses Zod inference
// and the web package needs plain interfaces. Consolidate when we add
// a build step to the shared package.

export interface FlowField {
  name: string
  type?: string
  changed?: boolean
  added?: boolean
  removed?: boolean
}

export interface FlowData {
  label: string
  color?: string
  fields?: FlowField[]
}

export interface FlowNode {
  id: string
  label: string
  type?: string
  icon?: string
  color?: string
  flow?: { nodes: FlowNode[]; steps: FlowStep[] }
}

export interface FlowStep {
  from?: string
  to?: string | string[]
  data: string | FlowData | FlowData[]
  drilldown?: boolean
  parallel?: FlowStep[]
}

export interface FlowMeta {
  title: string
  description?: string
  tags?: string[]
  path?: string
}

export interface Flow {
  meta: FlowMeta
  flow: { nodes: FlowNode[]; steps: FlowStep[] }
}
