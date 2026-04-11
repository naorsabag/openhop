import { ZodError } from "zod";
import { RootSchema, type Root, type Step } from "./schema.js";

export interface ValidationError {
  path: string;
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  success: boolean;
  data?: Root;
  errors: ValidationError[];
}

/**
 * Compute Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Find the closest matching node ID using Levenshtein distance.
 */
function findClosest(target: string, ids: string[]): string | undefined {
  let best: string | undefined;
  let bestDist = Infinity;
  for (const id of ids) {
    const d = levenshtein(target, id);
    if (d < bestDist && d <= Math.max(2, Math.floor(target.length / 2))) {
      bestDist = d;
      best = id;
    }
  }
  return best;
}

/**
 * Collect all node IDs from a flow body, checking for duplicates.
 */
function collectNodeIds(
  nodes: { id: string; flow?: { nodes: { id: string; flow?: any }[]; steps?: Step[] } }[],
  path: string,
  errors: ValidationError[],
  allIds: Set<string>
): void {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const nodePath = `${path}.nodes[${i}]`;
    if (allIds.has(node.id)) {
      errors.push({
        path: `${nodePath}.id`,
        message: `Duplicate node id "${node.id}"`,
      });
    } else {
      allIds.add(node.id);
    }
    if (node.flow) {
      collectNodeIds(node.flow.nodes, `${nodePath}.flow`, errors, allIds);
    }
  }
}

/**
 * Validate that step references point to existing node IDs.
 */
function validateStepRefs(
  steps: Step[] | undefined,
  nodeIds: Set<string>,
  path: string,
  errors: ValidationError[]
): void {
  if (!steps) return;
  const idsArray = Array.from(nodeIds);

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepPath = `${path}.steps[${i}]`;

    if ("parallel" in step) {
      for (let j = 0; j < step.parallel.length; j++) {
        const ps = step.parallel[j];
        const pPath = `${stepPath}.parallel[${j}]`;
        checkRef(ps.from, `${pPath}.from`, nodeIds, idsArray, errors);
        if (Array.isArray(ps.to)) {
          ps.to.forEach((t, k) => checkRef(t, `${pPath}.to[${k}]`, nodeIds, idsArray, errors));
        } else {
          checkRef(ps.to, `${pPath}.to`, nodeIds, idsArray, errors);
        }
      }
    } else {
      checkRef(step.from, `${stepPath}.from`, nodeIds, idsArray, errors);
      if (Array.isArray(step.to)) {
        step.to.forEach((t, k) => checkRef(t, `${stepPath}.to[${k}]`, nodeIds, idsArray, errors));
      } else {
        checkRef(step.to, `${stepPath}.to`, nodeIds, idsArray, errors);
      }
    }
  }
}

function checkRef(
  ref: string,
  path: string,
  nodeIds: Set<string>,
  idsArray: string[],
  errors: ValidationError[]
): void {
  if (!nodeIds.has(ref)) {
    const suggestion = findClosest(ref, idsArray);
    errors.push({
      path,
      message: `Node "${ref}" not found`,
      ...(suggestion ? { suggestion: `Did you mean "${suggestion}"?` } : {}),
    });
  }
}

/**
 * Recursively validate step refs for nested flows.
 */
function validateNestedFlowSteps(
  nodes: any[],
  path: string,
  errors: ValidationError[]
): void {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.flow) {
      const nestedPath = `${path}.nodes[${i}].flow`;
      const nestedIds = new Set<string>();
      // Collect IDs only within this nested flow scope
      for (const n of node.flow.nodes) {
        nestedIds.add(n.id);
      }
      validateStepRefs(node.flow.steps, nestedIds, nestedPath, errors);
      validateNestedFlowSteps(node.flow.nodes, nestedPath, errors);
    }
  }
}

/**
 * Validate a flow object (unknown input).
 * Phase 1: Zod structural validation
 * Phase 2: Semantic validation (ID uniqueness, step references)
 */
export function validateFlow(input: unknown): ValidationResult {
  // Phase 1: Zod parse
  const parseResult = RootSchema.safeParse(input);

  if (!parseResult.success) {
    const zodErrors = (parseResult.error as ZodError).issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    return { success: false, errors: zodErrors };
  }

  const data = parseResult.data;
  const errors: ValidationError[] = [];

  // Phase 2: Semantic validation
  const allIds = new Set<string>();
  collectNodeIds(data.flow.nodes, "flow", errors, allIds);
  validateStepRefs(data.flow.steps, allIds, "flow", errors);
  validateNestedFlowSteps(data.flow.nodes, "flow", errors);

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data, errors: [] };
}
