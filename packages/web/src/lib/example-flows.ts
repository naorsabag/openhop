/**
 * Curated example flows shown on the empty state of the Pages deploy.
 *
 * Each entry is the same YAML that lives in `examples/*.yaml` at the
 * repo root, imported as a raw string via Vite's `?raw` query so the
 * source-of-truth stays in one place. Vite inlines these into the
 * bundle — together they're ~6 KB which is comfortable to ship.
 */

import authFlow from '../../../../examples/auth-flow.yaml?raw'
import orderFlow from '../../../../examples/order-flow.yaml?raw'
import simpleCrud from '../../../../examples/simple-crud.yaml?raw'

export interface ExampleFlow {
  id: string
  title: string
  description: string
  path: string
  yaml: string
}

// Path field is what the Sidebar component groups into folders. Each
// example's path mirrors the meta.path in its YAML so a Pages visitor
// sees the same directory tree the local app would display.
export const EXAMPLE_FLOWS: ExampleFlow[] = [
  {
    id: 'simple-crud',
    title: 'Simple CRUD',
    description: 'Basic REST API CRUD — the smallest useful flow.',
    path: 'examples/crud',
    yaml: simpleCrud,
  },
  {
    id: 'auth-flow',
    title: 'OAuth2 Login',
    description: 'Browser → app → Google OAuth → DB + cache.',
    path: 'examples/auth',
    yaml: authFlow,
  },
  {
    id: 'order-flow',
    title: 'Order Processing',
    description: 'Multi-service order pipeline with payment, audit, and retry.',
    path: 'e-commerce/orders',
    yaml: orderFlow,
  },
]
