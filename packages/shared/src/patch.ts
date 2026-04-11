import { z } from "zod";
import type { Root } from "./schema.js";
import { validateFlow } from "./validator.js";

// --- Operation schemas (all support multiple items) ---

const nodeDefSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

const addNodesOp = z.object({
  op: z.literal("add-nodes"),
  nodes: z.array(nodeDefSchema).min(1),
});

const removeNodesOp = z.object({
  op: z.literal("remove-nodes"),
  nodes: z.array(z.string()).min(1), // array of node IDs
});

const renameNodesOp = z.object({
  op: z.literal("rename-nodes"),
  nodes: z.array(z.object({ id: z.string(), label: z.string() })).min(1),
});

const updateNodesOp = z.object({
  op: z.literal("update-nodes"),
  nodes: z.array(z.object({
    id: z.string(),
    type: z.string().optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
  })).min(1),
});

const setFlowsOp = z.object({
  op: z.literal("set-flows"),
  nodes: z.array(z.object({
    id: z.string(),
    flow: z.object({
      nodes: z.array(z.any()),
      steps: z.array(z.any()).optional(),
    }),
  })).min(1),
});

const clearFlowsOp = z.object({
  op: z.literal("clear-flows"),
  nodes: z.array(z.string()).min(1), // array of node IDs
});

const addStepsOp = z.object({
  op: z.literal("add-steps"),
  after: z.number().int().min(-1), // insert position
  steps: z.array(z.any()).min(1),
});

const removeStepsOp = z.object({
  op: z.literal("remove-steps"),
  indices: z.array(z.number().int().min(0)).min(1), // sorted descending when applied
});

const updateStepOp = z.object({
  op: z.literal("update-step"),
  index: z.number().int().min(0),
  step: z.any(), // the new step content
});

export const patchOperationSchema = z.discriminatedUnion("op", [
  addNodesOp,
  removeNodesOp,
  renameNodesOp,
  updateNodesOp,
  setFlowsOp,
  clearFlowsOp,
  addStepsOp,
  removeStepsOp,
  updateStepOp,
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

function findNode(nodes: any[], nodeId: string): any | undefined {
  return nodes.find((n: any) => n.id === nodeId);
}

function stepReferencesNode(step: any, nodeId: string): boolean {
  if ("parallel" in step) {
    return step.parallel.some((s: any) => stepReferencesNode(s, nodeId));
  }
  if (step.from === nodeId) return true;
  if (Array.isArray(step.to)) return step.to.includes(nodeId);
  return step.to === nodeId;
}

export function applyPatch(root: Root, patch: PatchOperations): PatchResult {
  const result = deepClone(root);
  const errors: PatchResult["errors"] = [];

  for (const op of patch.operations) {
    switch (op.op) {
      case "add-nodes": {
        for (const node of op.nodes) {
          if (findNode(result.flow.nodes, node.id)) {
            errors.push({ path: "flow.nodes", message: `Node "${node.id}" already exists` });
          } else {
            result.flow.nodes.push({ ...node } as any);
          }
        }
        break;
      }

      case "remove-nodes": {
        for (const nodeId of op.nodes) {
          const idx = result.flow.nodes.findIndex((n: any) => n.id === nodeId);
          if (idx === -1) {
            errors.push({ path: "flow.nodes", message: `Node "${nodeId}" not found` });
          } else {
            result.flow.nodes.splice(idx, 1);
            if (result.flow.steps) {
              result.flow.steps = result.flow.steps.filter(
                (s: any) => !stepReferencesNode(s, nodeId)
              );
            }
          }
        }
        break;
      }

      case "rename-nodes": {
        for (const { id, label } of op.nodes) {
          const node = findNode(result.flow.nodes, id);
          if (!node) {
            errors.push({ path: "flow.nodes", message: `Node "${id}" not found` });
          } else {
            node.label = label;
          }
        }
        break;
      }

      case "update-nodes": {
        for (const update of op.nodes) {
          const node = findNode(result.flow.nodes, update.id);
          if (!node) {
            errors.push({ path: "flow.nodes", message: `Node "${update.id}" not found` });
          } else {
            if (update.type !== undefined) node.type = update.type;
            if (update.icon !== undefined) node.icon = update.icon;
            if (update.color !== undefined) node.color = update.color;
          }
        }
        break;
      }

      case "set-flows": {
        for (const { id, flow } of op.nodes) {
          const node = findNode(result.flow.nodes, id);
          if (!node) {
            errors.push({ path: "flow.nodes", message: `Node "${id}" not found` });
          } else {
            node.flow = { nodes: flow.nodes, ...(flow.steps ? { steps: flow.steps } : {}) };
          }
        }
        break;
      }

      case "clear-flows": {
        for (const nodeId of op.nodes) {
          const node = findNode(result.flow.nodes, nodeId);
          if (!node) {
            errors.push({ path: "flow.nodes", message: `Node "${nodeId}" not found` });
          } else {
            delete node.flow;
          }
        }
        break;
      }

      case "add-steps": {
        if (!result.flow.steps) result.flow.steps = [];
        const insertIndex = op.after + 1;
        if (insertIndex > result.flow.steps.length) {
          errors.push({ path: "flow.steps", message: `Insert position ${op.after} is out of range` });
        } else {
          result.flow.steps.splice(insertIndex, 0, ...op.steps);
        }
        break;
      }

      case "remove-steps": {
        if (!result.flow.steps) {
          errors.push({ path: "flow.steps", message: "No steps to remove" });
          break;
        }
        // Sort indices descending to remove from end first (avoids index shifting)
        const sorted = [...op.indices].sort((a, b) => b - a);
        for (const idx of sorted) {
          if (idx >= result.flow.steps.length) {
            errors.push({ path: "flow.steps", message: `Step index ${idx} is out of range` });
          } else {
            result.flow.steps.splice(idx, 1);
          }
        }
        break;
      }

      case "update-step": {
        if (!result.flow.steps || op.index >= result.flow.steps.length) {
          errors.push({ path: "flow.steps", message: `Step index ${op.index} is out of range` });
        } else {
          result.flow.steps[op.index] = op.step;
        }
        break;
      }
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const validation = validateFlow(result);
  if (!validation.success) {
    return { success: false, errors: validation.errors };
  }

  return { success: true, data: validation.data, errors: [] };
}
