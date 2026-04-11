/**
 * JSON Schema representation of the FlowScope flow format.
 * Single source of truth — used by:
 * - Swagger/OpenAPI docs
 * - AI skill file
 * - External validation
 */

export const fieldJsonSchema = {
  type: 'object' as const,
  properties: {
    name: { type: 'string', description: 'Field name' },
    type: { type: 'string', description: 'Type annotation (e.g. int, list[Item])' },
    changed: { type: 'boolean', description: 'Highlight as modified (yellow)' },
    added: { type: 'boolean', description: 'Highlight as new (green)' },
    removed: { type: 'boolean', description: 'Highlight as removed (red strikethrough)' },
  },
  required: ['name'],
}

export const dataObjectJsonSchema = {
  type: 'object' as const,
  description: 'Detailed data with optional fields',
  properties: {
    label: { type: 'string', description: 'Data description' },
    color: { type: 'string', description: 'Override pixel color (hex)', pattern: '^#[0-9a-fA-F]{3,8}$' },
    fields: { type: 'array', items: fieldJsonSchema, description: 'Data fields shown in tooltip' },
  },
  required: ['label'],
}

export const dataJsonSchema = {
  oneOf: [
    { type: 'string' as const, description: 'Simple label (sketch mode)' },
    dataObjectJsonSchema,
    {
      type: 'array' as const,
      items: dataObjectJsonSchema,
      minItems: 1,
      description: 'Multiple data objects sent simultaneously',
    },
  ],
}

export const moveStepJsonSchema = {
  type: 'object' as const,
  properties: {
    from: { type: 'string', description: 'Source node ID' },
    to: {
      oneOf: [
        { type: 'string', description: 'Single target node ID' },
        { type: 'array', items: { type: 'string' }, description: 'Broadcast to multiple targets' },
      ],
    },
    data: dataJsonSchema,
    drilldown: { type: 'boolean', description: 'Auto-zoom into target sub-flow when this step plays' },
  },
  required: ['from', 'to', 'data'],
}

export const stepJsonSchema = {
  oneOf: [
    moveStepJsonSchema,
    {
      type: 'object' as const,
      description: 'Parallel steps — multiple movements at once',
      properties: {
        parallel: { type: 'array', items: moveStepJsonSchema, minItems: 2 },
      },
      required: ['parallel'],
    },
  ],
}

export const nodeJsonSchema: Record<string, unknown> = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', description: 'Unique ID (alphanumeric, hyphens, underscores)', pattern: '^[a-zA-Z0-9_-]+$' },
    label: { type: 'string', description: 'Display name' },
    type: {
      type: 'string',
      enum: ['actor', 'endpoint', 'transform', 'database', 'external', 'cache', 'queue', 'service', 'custom'],
      default: 'transform',
      description: 'Node type',
    },
    icon: { type: 'string', description: 'Iconify icon ID (e.g. logos:postgresql)' },
    color: { type: 'string', description: 'Hex color for border/accent', pattern: '^#[0-9a-fA-F]{3,8}$' },
    flow: {
      type: 'object',
      description: 'Nested sub-flow (makes node expandable)',
      additionalProperties: true,
    },
  },
  required: ['id', 'label'],
}

export const flowJsonSchema = {
  type: 'object' as const,
  properties: {
    nodes: { type: 'array', items: nodeJsonSchema, minItems: 1, description: 'Components in this flow' },
    steps: { type: 'array', items: stepJsonSchema, description: 'Ordered data movements' },
  },
  required: ['nodes'],
}

export const metaJsonSchema = {
  type: 'object' as const,
  properties: {
    title: { type: 'string', description: 'Flow title' },
    description: { type: 'string', description: 'Human-readable description' },
    tags: { type: 'array', items: { type: 'string' }, description: 'Tags for search/filter' },
    path: { type: 'string', description: 'Folder path (e.g. my-repo/backend). Folders are created implicitly.' },
  },
  required: ['title'],
}

export const rootJsonSchema = {
  type: 'object' as const,
  description: 'FlowScope flow definition',
  properties: {
    meta: metaJsonSchema,
    flow: flowJsonSchema,
  },
  required: ['meta', 'flow'],
}

/**
 * Full stored flow as returned by GET /api/flows/:id
 */
export const storedFlowJsonSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string', description: 'Flow ID' },
    meta: metaJsonSchema,
    flow: flowJsonSchema,
    version: { type: 'number', description: 'Version counter (increments on each update)' },
    createdAt: { type: 'string', description: 'ISO timestamp' },
    updatedAt: { type: 'string', description: 'ISO timestamp' },
  },
  required: ['id', 'meta', 'flow', 'version', 'createdAt', 'updatedAt'],
}

/**
 * Flow list item summary
 */
export const flowSummaryJsonSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string', nullable: true },
    tags: { type: 'array', items: { type: 'string' } },
    path: { type: 'string', nullable: true },
    version: { type: 'number' },
    updatedAt: { type: 'string' },
  },
}

/**
 * Patch operations schema — each operation type with its required fields
 */
export const patchOperationsJsonSchema = {
  type: 'object' as const,
  required: ['operations'],
  properties: {
    operations: {
      type: 'array' as const,
      description: 'Array of patch operations to apply sequentially. All operations support multiple items.',
      minItems: 1,
      items: {
        oneOf: [
          {
            type: 'object' as const,
            title: 'add-nodes',
            description: 'Add one or more new nodes',
            required: ['op', 'nodes'],
            properties: {
              op: { type: 'string', enum: ['add-nodes'] },
              nodes: {
                type: 'array', minItems: 1,
                items: {
                  type: 'object', required: ['id', 'label'],
                  properties: {
                    id: { type: 'string', description: 'Unique node ID' },
                    label: { type: 'string', description: 'Display name' },
                    type: { type: 'string', description: 'Node type' },
                    icon: { type: 'string', description: 'Iconify icon ID' },
                    color: { type: 'string', description: 'Hex color' },
                  },
                },
              },
            },
          },
          {
            type: 'object' as const,
            title: 'remove-nodes',
            description: 'Remove one or more nodes and all steps referencing them',
            required: ['op', 'nodes'],
            properties: {
              op: { type: 'string', enum: ['remove-nodes'] },
              nodes: { type: 'array', items: { type: 'string' }, minItems: 1, description: 'Node IDs to remove' },
            },
          },
          {
            type: 'object' as const,
            title: 'rename-nodes',
            description: 'Rename one or more nodes',
            required: ['op', 'nodes'],
            properties: {
              op: { type: 'string', enum: ['rename-nodes'] },
              nodes: {
                type: 'array', minItems: 1,
                items: {
                  type: 'object', required: ['id', 'label'],
                  properties: {
                    id: { type: 'string', description: 'Node ID' },
                    label: { type: 'string', description: 'New label' },
                  },
                },
              },
            },
          },
          {
            type: 'object' as const,
            title: 'update-nodes',
            description: 'Update type, icon, or color of one or more nodes',
            required: ['op', 'nodes'],
            properties: {
              op: { type: 'string', enum: ['update-nodes'] },
              nodes: {
                type: 'array', minItems: 1,
                items: {
                  type: 'object', required: ['id'],
                  properties: {
                    id: { type: 'string', description: 'Node ID' },
                    type: { type: 'string', description: 'New type' },
                    icon: { type: 'string', description: 'New icon' },
                    color: { type: 'string', description: 'New hex color' },
                  },
                },
              },
            },
          },
          {
            type: 'object' as const,
            title: 'set-flows',
            description: 'Add or replace sub-flows on one or more nodes',
            required: ['op', 'nodes'],
            properties: {
              op: { type: 'string', enum: ['set-flows'] },
              nodes: {
                type: 'array', minItems: 1,
                items: {
                  type: 'object', required: ['id', 'flow'],
                  properties: {
                    id: { type: 'string', description: 'Node ID' },
                    flow: { type: 'object', additionalProperties: true, description: 'Sub-flow { nodes, steps }' },
                  },
                },
              },
            },
          },
          {
            type: 'object' as const,
            title: 'clear-flows',
            description: 'Remove sub-flows from one or more nodes',
            required: ['op', 'nodes'],
            properties: {
              op: { type: 'string', enum: ['clear-flows'] },
              nodes: { type: 'array', items: { type: 'string' }, minItems: 1, description: 'Node IDs' },
            },
          },
          {
            type: 'object' as const,
            title: 'add-steps',
            description: 'Insert one or more steps at a position (-1 = beginning)',
            required: ['op', 'after', 'steps'],
            properties: {
              op: { type: 'string', enum: ['add-steps'] },
              after: { type: 'integer', minimum: -1, description: 'Insert after this index' },
              steps: { type: 'array', items: { type: 'object', additionalProperties: true }, minItems: 1, description: 'Steps to insert' },
            },
          },
          {
            type: 'object' as const,
            title: 'remove-steps',
            description: 'Remove one or more steps by index',
            required: ['op', 'indices'],
            properties: {
              op: { type: 'string', enum: ['remove-steps'] },
              indices: { type: 'array', items: { type: 'integer', minimum: 0 }, minItems: 1, description: 'Step indices to remove' },
            },
          },
          {
            type: 'object' as const,
            title: 'update-step',
            description: 'Replace a single step at a given index',
            required: ['op', 'index', 'step'],
            properties: {
              op: { type: 'string', enum: ['update-step'] },
              index: { type: 'integer', minimum: 0, description: 'Step index to update' },
              step: { type: 'object', additionalProperties: true, description: 'New step content' },
            },
          },
        ],
      },
    },
  },
}

/** Example for documentation (kept separate from schema to avoid AJV strict mode issues) */
export const patchOperationsExample = {
  operations: [
    { op: 'add-nodes', nodes: [{ id: 'cache', label: 'Redis', type: 'cache' }, { id: 'queue', label: 'Kafka', type: 'queue' }] },
    { op: 'rename-nodes', nodes: [{ id: 'api', label: 'API Gateway v2' }] },
    { op: 'remove-nodes', nodes: ['old-service'] },
    { op: 'add-steps', after: 1, steps: [{ from: 'api', to: 'cache', data: 'cache lookup' }] },
    { op: 'update-step', index: 0, step: { from: 'user', to: 'api', data: 'POST /v2/orders' } },
  ],
}
