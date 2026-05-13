/**
 * Curated example flows shown in the sidebar of the Pages deploy.
 *
 * Each entry's YAML is the same file in `examples/*.yaml` at the repo
 * root, imported as a raw string via Vite's `?raw` query so the source
 * of truth stays in one place. Vite inlines them into the bundle.
 *
 * The `path` is overridden so the sidebar tree groups flows under
 * `examples/` and `examples/showcase/` regardless of what each YAML's
 * own `meta.path` says (some use `e-commerce/orders`, `demos`, etc).
 */

import authFlow from '../../../../examples/auth-flow.yaml?raw'
import orderFlow from '../../../../examples/order-flow.yaml?raw'
import selfLoops from '../../../../examples/self-loops.yaml?raw'
import simpleCrud from '../../../../examples/simple-crud.yaml?raw'
import typeVariants from '../../../../examples/type-variants.yaml?raw'
import nodeIcons from '../../../../examples/node-icons.yaml?raw'
import parallel from '../../../../examples/parallel.yaml?raw'
import subFlows from '../../../../examples/sub-flows.yaml?raw'
import createDestroy from '../../../../examples/create-destroy.yaml?raw'
import aiBrowsingAgent from '../../../../examples/ai-browsing-agent.yaml?raw'

import showcaseOpenhop from '../../../../examples/showcase/openhop.yaml?raw'
import showcaseLanggraph from '../../../../examples/showcase/langgraph.yaml?raw'
import showcaseOpenaiCodex from '../../../../examples/showcase/openai-codex.yaml?raw'
import showcaseBlockGoose from '../../../../examples/showcase/block-goose.yaml?raw'
import showcaseVercelAiSdk from '../../../../examples/showcase/vercel-ai-sdk.yaml?raw'
import showcaseBrowserUse from '../../../../examples/showcase/browser-use.yaml?raw'
import showcaseAuthjsOauth from '../../../../examples/showcase/authjs-oauth.yaml?raw'
import showcaseOpenclaw from '../../../../examples/showcase/openclaw.yaml?raw'

export interface ExampleFlow {
  id: string
  title: string
  description: string
  path: string
  yaml: string
}

const EXAMPLES = 'examples'
const SHOWCASE = 'examples/showcase'

export const EXAMPLE_FLOWS: ExampleFlow[] = [
  {
    id: 'simple-crud',
    title: 'Simple CRUD',
    description: 'Basic REST API CRUD — the smallest useful flow.',
    path: EXAMPLES,
    yaml: simpleCrud,
  },
  {
    id: 'node-icons',
    title: 'Node Icons',
    description: 'Iconify brand-icon overlays on top of pixel sprites.',
    path: EXAMPLES,
    yaml: nodeIcons,
  },
  {
    id: 'auth-flow',
    title: 'OAuth2 Login',
    description: 'Browser → app → Google OAuth → DB + cache.',
    path: EXAMPLES,
    yaml: authFlow,
  },
  {
    id: 'order-flow',
    title: 'Order Processing',
    description: 'Multi-service order pipeline with payment, audit, and retry.',
    path: EXAMPLES,
    yaml: orderFlow,
  },
  {
    id: 'parallel',
    title: 'Parallel Fan-out',
    description: 'Concurrent broadcast — multiple deliveries firing in the same tick.',
    path: EXAMPLES,
    yaml: parallel,
  },
  {
    id: 'sub-flows',
    title: 'Sub-flows',
    description: 'A service node expanding into a nested flow on drill-down.',
    path: EXAMPLES,
    yaml: subFlows,
  },
  {
    id: 'create-destroy',
    title: 'Create / Destroy',
    description: 'Ephemeral nodes spun up for one step and torn down right after.',
    path: EXAMPLES,
    yaml: createDestroy,
  },
  {
    id: 'self-loops',
    title: 'Self-loops',
    description: 'Steps where from = to (retries, recursion), plus broadcasts and multi-data.',
    path: EXAMPLES,
    yaml: selfLoops,
  },
  {
    id: 'ai-browsing-agent',
    title: 'AI Browsing Agent',
    description: 'User → ai_agent ↔ LLM, agent ↔ browser ↔ website. Showcases the new sprites.',
    path: EXAMPLES,
    yaml: aiBrowsingAgent,
  },
  {
    id: 'type-variants',
    title: 'Type Variants Showcase',
    description: 'Five nodes of each type — shows the hue-cycle per-sprite coloring.',
    path: EXAMPLES,
    yaml: typeVariants,
  },

  // ── Showcase: hand-authored flows visualizing real code paths in OSS projects.
  {
    id: 'showcase-openhop',
    title: 'OpenHop, visualized in OpenHop',
    description: 'The self-referential hero — agent prompt → SKILL.md → CLI → playground URL.',
    path: SHOWCASE,
    yaml: showcaseOpenhop,
  },
  {
    id: 'showcase-langgraph',
    title: 'LangGraph ReAct',
    description: 'START → agent node → conditional edge → tool node → END.',
    path: SHOWCASE,
    yaml: showcaseLanggraph,
  },
  {
    id: 'showcase-openai-codex',
    title: 'OpenAI Codex CLI',
    description: 'Codex CLI tool-call loop — prompt → model → tool → output.',
    path: SHOWCASE,
    yaml: showcaseOpenaiCodex,
  },
  {
    id: 'showcase-block-goose',
    title: 'block/goose',
    description: 'goose MCP + skills loop — prompt → core → MCP client → server → reply.',
    path: SHOWCASE,
    yaml: showcaseBlockGoose,
  },
  {
    id: 'showcase-vercel-ai-sdk',
    title: 'Vercel AI SDK',
    description: 'useChat → /api/chat → streamText → tool call → SSE stream → UI re-render.',
    path: SHOWCASE,
    yaml: showcaseVercelAiSdk,
  },
  {
    id: 'showcase-browser-use',
    title: 'browser-use',
    description: 'LLM driving a real browser via Playwright, step-by-step.',
    path: SHOWCASE,
    yaml: showcaseBrowserUse,
  },
  {
    id: 'showcase-authjs-oauth',
    title: 'Auth.js OAuth + PKCE',
    description: 'Browser → app → provider → callback → token exchange.',
    path: SHOWCASE,
    yaml: showcaseAuthjsOauth,
  },
  {
    id: 'showcase-openclaw',
    title: 'OpenClaw',
    description: 'Agent loop — prompt → skill router → tool → tool response → reply.',
    path: SHOWCASE,
    yaml: showcaseOpenclaw,
  },
]
