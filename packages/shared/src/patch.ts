import { z } from "zod";
import type { Root } from "./schema.js";
import { validateFlow } from "./validator.js";

// --- Operation schemas ---

const addNodeOp = z.object({
  op: z.literal("add-node"),
  node: z.object({
    id: z.string(),
    label: z.string(),
    type: z.string().optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
  }),
});

const removeNodeOp = z.object({
  op: z.literal("remove-node"),
  node: z.string(),
});

const renameNodeOp = z.object({
  op: z.literal("rename-node"),
  node: z.string(),
  label: z.string(),
});

const updateNodeOp = z.object({
  op: z.literal("update-node"),
  node: z.string(),
  type: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

const setFlowOp = z.object({
  op: z.literal("set-flow"),
  node: z.string(),
  flow: z.object({
    nodes: z.array(z.any()),
    steps: z.array(z.any()).optional(),
  }),
});

const clearFlowOp = z.object({
  op: z.literal("clear-flow"),
  node: z.string(),
});

const addStepOp = z.object({
  op: z.literal("add-step"),
  after: z.number().int().min(-1),
  step: z.any(),
});

const removeStepOp = z.object({
  op: z.literal("remove-step"),
  index: z.number().int().min(0),
});

const replaceStepsOp = z.object({
  op: z.literal("replace-steps"),
  steps: z.array(z.any()),
});

export const patchOperationSchema = z.discriminatedUnion("op", [
  addNodeOp,
  removeNodeOp,
  renameNodeOp,
  updateNodeOp,
  setFlowOp,
  clearFlowOp,
  addStepOp,
  removeStepOp,
  replaceStepsOp,
]);

export const patchSchema = z.object({
  operations: z.array(patchOperationSchema).min(1),
});

export type PatchOperation = z.infer<typeof patchOperationSchema>;
export type PatchOperations = z.infer<typeof patchSchema>;

// --- Apply patch ---

export interface PatchResult {
  success: boolean;
  data?: Root;
  errors: Array<{ path: string; message: string; suggestion?: string }>;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Find a node by ID in the top-level flow nodes.
 */
function findNode(
  nodes: any[],
  nodeId: string
): any | undefined {
  return nodes.find((n: any) => n.id === nodeId);
}

/**
 * Check whether a step references a given node ID (in from or to).
 */
function stepReferencesNode(step: any, nodeId: string): boolean {
  if ("parallel" in step) {
    return step.parallel.some((s: any) => stepReferencesNode(s, nodeId));
  }
  if (step.from === nodeId) return true;
  if (Array.isArray(step.to)) {
    return step.to.includes(nodeId);
  }
  return step.to === nodeId;
}

/**
 * Apply a set of patch operations to a Root flow and return the result.
 * After applying all operations, the resulting flow is validated.
 */
export function applyPatch(root: Root, patch: PatchOperations): PatchResult {
  const result = deepClone(root);
  const errors: PatchResult["errors"] = [];

  for (const op of patch.operations) {
    switch (op.op) {
      case "add-node": {
        const existing = findNode(result.flow.nodes, op.node.id);
        if (existing) {
          errors.push({
            path: `flow.nodes`,
            message: `Node "${op.node.id}" already exists`,
          });
          break;
        }
        result.flow.nodes.push({ ...op.node } as any);
        break;
      }

      case "remove-node": {
        const idx = result.flow.nodes.findIndex((n: any) => n.id === op.node);
        if (idx === -1) {
          errors.push({
            path: `flow.nodes`,
            message: `Node "${op.node}" not found`,
          });
          break;
        }
        result.flow.nodes.splice(idx, 1);
        // Remove steps that reference this node
        if (result.flow.steps) {
          result.flow.steps = result.flow.steps.filter(
            (s: any) => !stepReferencesNode(s, op.node)
          );
        }
        break;
      }

      case "rename-node": {
        const node = findNode(result.flow.nodes, op.node);
        if (!node) {
          errors.push({
            path: `flow.nodes`,
            message: `Node "${op.node}" not found`,
          });
          break;
        }
        node.label = op.label;
        break;
      }

      case "update-node": {
        const node = findNode(result.flow.nodes, op.node);
        if (!node) {
          errors.push({
            path: `flow.nodes`,
            message: `Node "${op.node}" not found`,
          });
          break;
        }
        if (op.type !== undefined) node.type = op.type;
        if (op.icon !== undefined) node.icon = op.icon;
        if (op.color !== undefined) node.color = op.color;
        break;
      }

      case "set-flow": {
        const node = findNode(result.flow.nodes, op.node);
        if (!node) {
          errors.push({
            path: `flow.nodes`,
            message: `Node "${op.node}" not found`,
          });
          break;
        }
        node.flow = { nodes: op.flow.nodes, ...(op.flow.steps ? { steps: op.flow.steps } : {}) };
        break;
      }

      case "clear-flow": {
        const node = findNode(result.flow.nodes, op.node);
        if (!node) {
          errors.push({
            path: `flow.nodes`,
            message: `Node "${op.node}" not found`,
          });
          break;
        }
        delete node.flow;
        break;
      }

      case "add-step": {
        if (!result.flow.steps) {
          result.flow.steps = [];
        }
        const insertIndex = op.after + 1;
        if (insertIndex > result.flow.steps.length) {
          errors.push({
            path: `flow.steps`,
            message: `Insert position ${op.after} is out of range (max ${result.flow.steps.length - 1})`,
          });
          break;
        }
        result.flow.steps.splice(insertIndex, 0, op.step);
        break;
      }

      case "remove-step": {
        if (!result.flow.steps || op.index >= result.flow.steps.length) {
          errors.push({
            path: `flow.steps`,
            message: `Step index ${op.index} is out of range`,
          });
          break;
        }
        result.flow.steps.splice(op.index, 1);
        break;
      }

      case "replace-steps": {
        result.flow.steps = op.steps;
        break;
      }
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  // Validate the resulting flow
  const validation = validateFlow(result);
  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  return { success: true, data: validation.data, errors: [] };
}
