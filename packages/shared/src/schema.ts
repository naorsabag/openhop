import { z } from 'zod'

// --- Enums ---

export const NodeTypeEnum = z.enum([
  'actor',
  'endpoint',
  'auth',
  'database',
  'external',
  'cache',
  'queue',
  'service',
  'docker',
  'k8s',
  'scheduler',
  'ai_agent',
  'browser',
  'custom',
])

export type NodeType = z.infer<typeof NodeTypeEnum>

// --- Hex color pattern ---

const hexColor = z.string().regex(/^#[0-9a-fA-F]{3,8}$/, 'Must be a valid hex color')

// --- Field ---

export const FieldSchema = z.object({
  name: z.string().min(1, 'Field name is required'),
  type: z.string().optional(),
  changed: z.boolean().optional(),
  added: z.boolean().optional(),
  removed: z.boolean().optional(),
})

export type Field = z.infer<typeof FieldSchema>
export type FlowField = Field

// --- Data ---

export const DataObjectSchema = z.object({
  label: z.string().min(1, 'Data label is required'),
  color: hexColor.optional(),
  fields: z.array(FieldSchema).optional(),
})

export const DataSchema = z.union([z.string(), DataObjectSchema, z.array(DataObjectSchema).min(1)])

export type Data = z.infer<typeof DataSchema>
export type FlowData = z.infer<typeof DataObjectSchema>

// --- Step schemas ---

export const MoveStepSchema = z.object({
  from: z.string().min(1),
  to: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  data: DataSchema,
  drilldown: z.boolean().optional(),
})

export type MoveStep = z.infer<typeof MoveStepSchema>

export const ParallelStepSchema = z.object({
  parallel: z.array(MoveStepSchema).min(2, 'Parallel steps require at least 2 items'),
})

export type ParallelStep = z.infer<typeof ParallelStepSchema>

export const CreateStepSchema = z.object({
  create: z.string().min(1), // node ID being created
  from: z.string().min(1), // who creates it — pixel travels from here to the new node
  node: z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    type: NodeTypeEnum.optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
  }),
  data: DataSchema.optional(), // constructor data
})

export type CreateStep = z.infer<typeof CreateStepSchema>

export const DestroyStepSchema = z.object({
  destroy: z.string().min(1), // node ID being destroyed
})

export type DestroyStep = z.infer<typeof DestroyStepSchema>

export const StepSchema = z.union([
  MoveStepSchema,
  ParallelStepSchema,
  CreateStepSchema,
  DestroyStepSchema,
])

export type Step = z.infer<typeof StepSchema>

/** Flat step interface — all fields optional.
 *  This is intentionally NOT derived from the Zod union type because TypeScript's
 *  discriminated union narrowing makes it impractical for frontend code that
 *  needs to handle move, parallel, create, and destroy steps uniformly
 *  (e.g., animation logic, layout, pixel rendering). Keep in sync with StepSchema. */
export interface FlowStep {
  from?: string
  to?: string | string[]
  data?: Data
  drilldown?: boolean
  parallel?: FlowStep[]
  create?: string // node ID being created
  node?: { id: string; label: string; type?: string; icon?: string; color?: string }
  destroy?: string // node ID being destroyed
}

// --- Flow (recursive) ---

export const FlowSchema: z.ZodType<{
  nodes: NodeShape[]
  steps?: Step[]
}> = z.lazy(() =>
  z.object({
    nodes: z.array(NodeSchema).min(1, 'Flow must have at least 1 node'),
    steps: z.array(StepSchema).optional(),
  })
)

// We need a shape type for the recursive reference
export interface NodeShape {
  id: string
  label: string
  type?: NodeType
  icon?: string
  color?: string
  flow?: { nodes: NodeShape[]; steps?: Step[] }
}

export const NodeSchema: z.ZodType<NodeShape> = z.lazy(() =>
  z.object({
    id: z
      .string()
      .min(1, 'Node id is required')
      .regex(/^[a-zA-Z0-9_-]+$/, 'Node id must be alphanumeric with hyphens and underscores'),
    label: z.string().min(1, 'Node label is required'),
    type: NodeTypeEnum.default('service').optional(),
    icon: z.string().optional(),
    color: hexColor.optional(),
    flow: FlowSchema.optional(),
  })
)

export type FlowNode = z.infer<typeof NodeSchema>
export type FlowBody = z.infer<typeof FlowSchema>

// --- Meta ---

export const MetaSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  path: z.string().optional(),
})

export type Meta = z.infer<typeof MetaSchema>
export type FlowMeta = Meta

// --- Root ---

export const RootSchema = z.object({
  meta: MetaSchema,
  flow: FlowSchema,
})

export type Root = z.infer<typeof RootSchema>
export type Flow = Root
