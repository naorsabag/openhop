import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFlowYaml, type Root } from '@openhop/shared'
import { FlowStore } from './store.js'

const EXAMPLE_FLOW_ID = 'example-order-flow'

async function loadExampleOrderFlow(): Promise<Root | null> {
  const possiblePaths = [
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'examples', 'order-flow.yaml'),
    join(process.cwd(), 'examples', 'order-flow.yaml'),
  ]

  for (const path of possiblePaths) {
    try {
      const yaml = await readFile(path, 'utf-8')
      const result = parseFlowYaml(yaml)
      if (result.success && result.data) {
        return result.data
      }
    } catch {
      // Try the next candidate path.
    }
  }

  return null
}

export async function syncExampleOrderFlow(
  store: FlowStore
): Promise<'created' | 'updated' | 'skipped'> {
  const example = await loadExampleOrderFlow()
  if (!example) return 'skipped'

  const existing = await store.get(EXAMPLE_FLOW_ID)
  if (existing) {
    await store.updateFlow(EXAMPLE_FLOW_ID, example)
    return 'updated'
  }

  await store.save(EXAMPLE_FLOW_ID, example)
  return 'created'
}
