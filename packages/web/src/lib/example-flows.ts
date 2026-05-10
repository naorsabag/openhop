/**
 * Curated example flows shown in the sidebar of the Pages deploy.
 *
 * Each entry's YAML is the same file in `examples/*.yaml` at the repo
 * root, imported as a raw string via Vite's `?raw` query so the source
 * of truth stays in one place. Vite inlines them into the bundle.
 *
 * The `path` is overridden to `examples` for every entry so the sidebar
 * tree groups all examples under a single `examples/` folder, even
 * though the YAMLs' own `meta.path` values diverge (some use
 * `e-commerce/orders`, `demos`, etc).
 */

import authFlow from '../../../../examples/auth-flow.yaml?raw'
import orderFlow from '../../../../examples/order-flow.yaml?raw'
import selfLoops from '../../../../examples/self-loops.yaml?raw'
import simpleCrud from '../../../../examples/simple-crud.yaml?raw'
import typeVariants from '../../../../examples/type-variants.yaml?raw'

export interface ExampleFlow {
  id: string
  title: string
  description: string
  path: string
  yaml: string
}

const EXAMPLES_ROOT = 'examples'

export const EXAMPLE_FLOWS: ExampleFlow[] = [
  {
    id: 'simple-crud',
    title: 'Simple CRUD',
    description: 'Basic REST API CRUD — the smallest useful flow.',
    path: EXAMPLES_ROOT,
    yaml: simpleCrud,
  },
  {
    id: 'auth-flow',
    title: 'OAuth2 Login',
    description: 'Browser → app → Google OAuth → DB + cache.',
    path: EXAMPLES_ROOT,
    yaml: authFlow,
  },
  {
    id: 'order-flow',
    title: 'Order Processing',
    description: 'Multi-service order pipeline with payment, audit, and retry.',
    path: EXAMPLES_ROOT,
    yaml: orderFlow,
  },
  {
    id: 'self-loops',
    title: 'Self-loops',
    description: 'Steps where from = to (retries, recursion), plus broadcasts and multi-data.',
    path: EXAMPLES_ROOT,
    yaml: selfLoops,
  },
  {
    id: 'type-variants',
    title: 'Type Variants Showcase',
    description: 'Five nodes of each type — shows the hue-cycle per-sprite coloring.',
    path: EXAMPLES_ROOT,
    yaml: typeVariants,
  },
]
