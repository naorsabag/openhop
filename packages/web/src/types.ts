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
  type?: string // actor, endpoint, transform, database, external, cache, queue, service, custom
  icon?: string
  color?: string
  flow?: { nodes: FlowNode[]; steps: FlowStep[] }
}

export interface FlowStep {
  from?: string
  to?: string | string[]
  data: string | FlowData
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
