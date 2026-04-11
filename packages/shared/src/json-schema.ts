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

export const dataJsonSchema = {
  oneOf: [
    { type: 'string' as const, description: 'Simple label (sketch mode)' },
    {
      type: 'object' as const,
      description: 'Detailed data with optional fields',
      properties: {
        label: { type: 'string', description: 'Data description' },
        color: { type: 'string', description: 'Override pixel color (hex)', pattern: '^#[0-9a-fA-F]{3,8}$' },
        fields: { type: 'array', items: fieldJsonSchema, description: 'Data fields shown in tooltip' },
      },
      required: ['label'],
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
      description: 'Array of patch operations to apply sequentially',
      minItems: 1,
      items: {
        oneOf: [
          {
            type: 'object' as const,
            title: 'add-node',
            description: 'Add a new node to the flow',
            required: ['op', 'node'],
            properties: {
              op: { type: 'string', enum: ['add-node'] },
              node: {
                type: 'object',
                required: ['id', 'label'],
                properties: {
                  id: { type: 'string', description: 'Unique node ID' },
                  label: { type: 'string', description: 'Display name' },
                  type: { type: 'string', description: 'Node type (actor, endpoint, database, etc.)' },
                  icon: { type: 'string', description: 'Iconify icon ID' },
                  color: { type: 'string', description: 'Hex color' },
                },
              },
            },
          },
          {
            type: 'object' as const,
            title: 'remove-node',
            description: 'Remove a node and all steps referencing it',
            required: ['op', 'node'],
            properties: {
              op: { type: 'string', enum: ['remove-node'] },
              node: { type: 'string', description: 'Node ID to remove' },
            },
          },
          {
            type: 'object' as const,
            title: 'rename-node',
            description: 'Change a node label',
            required: ['op', 'node', 'label'],
            properties: {
              op: { type: 'string', enum: ['rename-node'] },
              node: { type: 'string', description: 'Node ID' },
              label: { type: 'string', description: 'New label' },
            },
          },
          {
            type: 'object' as const,
            title: 'update-node',
            description: 'Update node type, icon, or color',
            required: ['op', 'node'],
            properties: {
              op: { type: 'string', enum: ['update-node'] },
              node: { type: 'string', description: 'Node ID' },
              type: { type: 'string', description: 'New node type' },
              icon: { type: 'string', description: 'New icon' },
              color: { type: 'string', description: 'New hex color' },
            },
          },
          {
            type: 'object' as const,
            title: 'set-flow',
            description: 'Add or replace a sub-flow on a node',
            required: ['op', 'node', 'flow'],
            properties: {
              op: { type: 'string', enum: ['set-flow'] },
              node: { type: 'string', description: 'Node ID' },
              flow: { type: 'object', additionalProperties: true, description: 'Sub-flow with nodes and steps' },
            },
          },
          {
            type: 'object' as const,
            title: 'clear-flow',
            description: 'Remove a sub-flow from a node',
            required: ['op', 'node'],
            properties: {
              op: { type: 'string', enum: ['clear-flow'] },
              node: { type: 'string', description: 'Node ID' },
            },
          },
          {
            type: 'object' as const,
            title: 'add-step',
            description: 'Insert a step at a position (-1 = beginning)',
            required: ['op', 'after', 'step'],
            properties: {
              op: { type: 'string', enum: ['add-step'] },
              after: { type: 'integer', minimum: -1, description: 'Insert after this index (-1 = at beginning)' },
              step: { type: 'object', additionalProperties: true, description: 'Step definition (from/to/data or parallel)' },
            },
          },
          {
            type: 'object' as const,
            title: 'remove-step',
            description: 'Remove a step by index',
            required: ['op', 'index'],
            properties: {
              op: { type: 'string', enum: ['remove-step'] },
              index: { type: 'integer', minimum: 0, description: 'Step index to remove' },
            },
          },
          {
            type: 'object' as const,
            title: 'replace-steps',
            description: 'Replace the entire steps array',
            required: ['op', 'steps'],
            properties: {
              op: { type: 'string', enum: ['replace-steps'] },
              steps: { type: 'array', items: { type: 'object', additionalProperties: true }, description: 'New steps array' },
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
    { op: 'add-node', node: { id: 'cache', label: 'Redis', type: 'cache', icon: 'logos:redis', color: '#DC382D' } },
    { op: 'rename-node', node: 'api', label: 'API Gateway v2' },
    { op: 'add-step', after: 1, step: { from: 'api', to: 'cache', data: 'cache lookup' } },
  ],
}
