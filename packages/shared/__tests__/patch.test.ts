import { describe, it, expect } from "vitest";
import { applyPatch, patchSchema } from "../src/patch";
import type { Root } from "../src/schema";

// --- Helpers ---

function makeRoot(overrides?: Partial<Root>): Root {
  return {
    meta: { title: "Test Flow" },
    flow: {
      nodes: [
        { id: "a", label: "Node A" },
        { id: "b", label: "Node B" },
      ],
      steps: [{ from: "a", to: "b", data: "request" }],
    },
    ...overrides,
  } as Root;
}

describe("patchSchema validation", () => {
  it("rejects empty operations array", () => {
    const result = patchSchema.safeParse({ operations: [] });
    expect(result.success).toBe(false);
  });

  it("rejects unknown operation type", () => {
    const result = patchSchema.safeParse({
      operations: [{ op: "unknown-op" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid operations", () => {
    const result = patchSchema.safeParse({
      operations: [
        { op: "add-nodes", nodes: [{ id: "c", label: "Node C" }] },
        { op: "rename-nodes", nodes: [{ id: "a", label: "New A" }] },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("applyPatch", () => {
  describe("add-nodes", () => {
    it("adds a new node to the flow", () => {
      const root = makeRoot();
      const result = applyPatch(root, {
        operations: [
          { op: "add-nodes", nodes: [{ id: "c", label: "Node C", type: "cache" }] },
        ],
      });
      expect(result.success).toBe(true);
      expect(result.data!.flow.nodes).toHaveLength(3);
      expect(result.data!.flow.nodes[2]).toMatchObject({
        id: "c",
        label: "Node C",
      });
    });

    it("returns error for duplicate node ID", () => {
      const root = makeRoot();
      const result = applyPatch(root, {
        operations: [
          { op: "add-nodes", nodes: [{ id: "a", label: "Duplicate" }] },
        ],
      });
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain("already exists");
    });
  });

  describe("remove-nodes", () => {
    it("removes a node and its referencing steps", () => {
      const root = makeRoot();
      const result = applyPatch(root, {
        operations: [{ op: "remove-nodes", nodes: ["b"] }],
      });
      expect(result.success).toBe(true);
      expect(result.data!.flow.nodes).toHaveLength(1);
      expect(result.data!.flow.nodes[0].id).toBe("a");
      // The step from a->b should be removed since it references "b"
      expect(result.data!.flow.steps ?? []).toHaveLength(0);
    });

    it("returns error for nonexistent node", () => {
      const root = makeRoot();
      const result = applyPatch(root, {
        operations: [{ op: "remove-nodes", nodes: ["nonexistent"] }],
      });
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain("not found");
    });
  });

  describe("rename-nodes", () => {
    it("renames an existing node", () => {
      const root = makeRoot();
      const result = applyPatch(root, {
        operations: [{ op: "rename-nodes", nodes: [{ id: "a", label: "Renamed A" }] }],
      });
      expect(result.success).toBe(true);
      expect(result.data!.flow.nodes[0].label).toBe("Renamed A");
    });

    it("returns error for nonexistent node", () => {
      const root = makeRoot();
      const result = applyPatch(root, {
        operations: [{ op: "rename-nodes", nodes: [{ id: "missing", label: "X" }] }],
      });
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain("not found");
    });
  });

  describe("update-nodes", () => {
    it("updates node type, icon, and color", () => {
      const root = makeRoot();
      const result = applyPatch(root, {
        operations: [
          {
            op: "update-nodes",
            nodes: [{ id: "a", type: "database", icon: "db-icon", color: "#00ff00" }],
          },
        ],
      });
      expect(result.success).toBe(true);
      const node = result.data!.flow.nodes.find((n) => n.id === "a");
      expect(node!.type).toBe("database");
      expect(node!.icon).toBe("db-icon");
      expect(node!.color).toBe("#00ff00");
    });

    it("returns error for nonexistent node", () => {
      const root = makeRoot();
      const result = applyPatch(root, {
        operations: [{ op: "update-nodes", nodes: [{ id: "missing", type: "cache" }] }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("set-flows", () => {
    it("sets a sub-flow on a node", () => {
      const root = makeRoot();
      const result = applyPatch(root, {
        operations: [
          {
            op: "set-flows",
            nodes: [
              {
                id: "a",
                flow: {
                  nodes: [
                    { id: "x", label: "Sub X" },
                    { id: "y", label: "Sub Y" },
                  ],
                  steps: [{ from: "x", to: "y", data: "inner" }],
                },
              },
            ],
          },
        ],
      });
      expect(result.success).toBe(true);
      const nodeA = result.data!.flow.nodes.find((n) => n.id === "a");
      expect(nodeA!.flow).toBeDefined();
      expect(nodeA!.flow!.nodes).toHaveLength(2);
    });

    it("returns error for nonexistent node", () => {
      const root = makeRoot();
      const result = applyPatch(root, {
        operations: [
          {
            op: "set-flows",
            nodes: [{ id: "missing", flow: { nodes: [{ id: "x", label: "X" }] } }],
          },
        ],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("clear-flows", () => {
    it("removes a sub-flow from a node", () => {
      const root: Root = {
        meta: { title: "Test" },
        flow: {
          nodes: [
            {
              id: "a",
              label: "A",
              flow: {
                nodes: [{ id: "x", label: "X" }],
              },
            },
            { id: "b", label: "B" },
          ],
          steps: [{ from: "a", to: "b", data: "msg" }],
        },
      } as Root;

      const result = applyPatch(root, {
        operations: [{ op: "clear-flows", nodes: ["a"] }],
      });
      expect(result.success).toBe(true);
      const nodeA = result.data!.flow.nodes.find((n) => n.id === "a");
      expect(nodeA!.flow).toBeUndefined();
    });

    it("returns error for nonexistent node", () => {
      const root = makeRoot();
      const result = applyPatch(root, {
        operations: [{ op: "clear-flows", nodes: ["missing"] }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("add-steps", () => {
    it("inserts a step at the beginning (after=-1)", () => {
      const root = makeRoot();
      const result = applyPatch(root, {
        operations: [
          {
            op: "add-steps",
            after: -1,
            steps: [{ from: "b", to: "a", data: "response" }],
          },
        ],
      });
      expect(result.success).toBe(true);
      expect(result.data!.flow.steps).toHaveLength(2);
      expect(result.data!.flow.steps![0]).toMatchObject({
        from: "b",
        to: "a",
        data: "response",
      });
    });

    it("inserts a step after a given index", () => {
      const root = makeRoot();
      const result = applyPatch(root, {
        operations: [
          {
            op: "add-steps",
            after: 0,
            steps: [{ from: "b", to: "a", data: "response" }],
          },
        ],
      });
      expect(result.success).toBe(true);
      expect(result.data!.flow.steps).toHaveLength(2);
      expect(result.data!.flow.steps![1]).toMatchObject({
        from: "b",
        to: "a",
      });
    });
  });

  describe("remove-steps", () => {
    it("removes a step by index", () => {
      const root = makeRoot();
      const result = applyPatch(root, {
        operations: [{ op: "remove-steps", indices: [0] }],
      });
      expect(result.success).toBe(true);
      expect(result.data!.flow.steps ?? []).toHaveLength(0);
    });

    it("returns error for out-of-range index", () => {
      const root = makeRoot();
      const result = applyPatch(root, {
        operations: [{ op: "remove-steps", indices: [99] }],
      });
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain("out of range");
    });
  });

  describe("update-step", () => {
    it("replaces a step by index", () => {
      const root = makeRoot();
      const result = applyPatch(root, {
        operations: [
          {
            op: "update-step",
            index: 0,
            step: { from: "b", to: "a", data: "reversed" },
          },
        ],
      });
      expect(result.success).toBe(true);
      expect(result.data!.flow.steps![0]).toMatchObject({
        from: "b",
        to: "a",
        data: "reversed",
      });
    });
  });

  describe("multiple operations", () => {
    it("applies multiple operations in sequence", () => {
      const root = makeRoot();
      const result = applyPatch(root, {
        operations: [
          { op: "add-nodes", nodes: [{ id: "c", label: "Node C" }] },
          { op: "rename-nodes", nodes: [{ id: "a", label: "Alpha" }] },
          { op: "remove-steps", indices: [0] },
          {
            op: "add-steps",
            after: -1,
            steps: [
              { from: "a", to: "c", data: "new step" },
              { from: "c", to: "b", data: "another" },
            ],
          },
        ],
      });
      expect(result.success).toBe(true);
      expect(result.data!.flow.nodes).toHaveLength(3);
      expect(result.data!.flow.nodes[0].label).toBe("Alpha");
      expect(result.data!.flow.steps).toHaveLength(2);
    });
  });

  describe("validation after patch", () => {
    it("returns validation errors for invalid resulting flow", () => {
      const root = makeRoot();
      // Add a step referencing a node that doesn't exist
      const result = applyPatch(root, {
        operations: [
          {
            op: "add-steps",
            after: 0,
            steps: [{ from: "a", to: "ghost", data: "bad" }],
          },
        ],
      });
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.message.includes("not found"))).toBe(
        true
      );
    });
  });

  it("does not mutate the original root", () => {
    const root = makeRoot();
    const originalNodeCount = root.flow.nodes.length;
    applyPatch(root, {
      operations: [
        { op: "add-nodes", nodes: [{ id: "c", label: "Node C" }] },
      ],
    });
    expect(root.flow.nodes).toHaveLength(originalNodeCount);
  });
});
