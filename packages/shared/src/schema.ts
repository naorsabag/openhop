import { z } from "zod";

// --- Enums ---

export const NodeTypeEnum = z.enum([
  "actor",
  "endpoint",
  "transform",
  "database",
  "external",
  "cache",
  "queue",
  "service",
  "custom",
]);

export type NodeType = z.infer<typeof NodeTypeEnum>;

// --- Hex color pattern ---

const hexColor = z.string().regex(/^#[0-9a-fA-F]{3,8}$/, "Must be a valid hex color");

// --- Field ---

export const FieldSchema = z.object({
  name: z.string().min(1, "Field name is required"),
  type: z.string().optional(),
  changed: z.boolean().optional(),
  added: z.boolean().optional(),
  removed: z.boolean().optional(),
});

export type Field = z.infer<typeof FieldSchema>;

// --- Data ---

export const DataObjectSchema = z.object({
  label: z.string().min(1, "Data label is required"),
  color: hexColor.optional(),
  fields: z.array(FieldSchema).optional(),
});

export const DataSchema = z.union([z.string(), DataObjectSchema]);

export type Data = z.infer<typeof DataSchema>;

// --- Step schemas ---

export const MoveStepSchema = z.object({
  from: z.string().min(1),
  to: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  data: DataSchema,
  drilldown: z.boolean().optional(),
});

export type MoveStep = z.infer<typeof MoveStepSchema>;

export const ParallelStepSchema = z.object({
  parallel: z.array(MoveStepSchema).min(2, "Parallel steps require at least 2 items"),
});

export type ParallelStep = z.infer<typeof ParallelStepSchema>;

export const StepSchema = z.union([MoveStepSchema, ParallelStepSchema]);

export type Step = z.infer<typeof StepSchema>;

// --- Flow (recursive) ---

export const FlowSchema: z.ZodType<{
  nodes: NodeShape[];
  steps?: Step[];
}> = z.lazy(() =>
  z.object({
    nodes: z.array(NodeSchema).min(1, "Flow must have at least 1 node"),
    steps: z.array(StepSchema).optional(),
  })
);

// We need a shape type for the recursive reference
interface NodeShape {
  id: string;
  label: string;
  type?: NodeType;
  icon?: string;
  color?: string;
  flow?: { nodes: NodeShape[]; steps?: Step[] };
}

export const NodeSchema: z.ZodType<NodeShape> = z.lazy(() =>
  z.object({
    id: z
      .string()
      .min(1, "Node id is required")
      .regex(/^[a-zA-Z0-9_-]+$/, "Node id must be alphanumeric with hyphens and underscores"),
    label: z.string().min(1, "Node label is required"),
    type: NodeTypeEnum.default("transform").optional(),
    icon: z.string().optional(),
    color: hexColor.optional(),
    flow: FlowSchema.optional(),
  })
);

export type FlowNode = z.infer<typeof NodeSchema>;
export type FlowBody = z.infer<typeof FlowSchema>;

// --- Meta ---

export const MetaSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  path: z.string().optional(),
});

export type Meta = z.infer<typeof MetaSchema>;

// --- Root ---

export const RootSchema = z.object({
  meta: MetaSchema,
  flow: FlowSchema,
});

export type Root = z.infer<typeof RootSchema>;
