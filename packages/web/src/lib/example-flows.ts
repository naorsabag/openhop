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

import nodeIcons from '../../../../examples/node-icons.yaml?raw'
import parallel from '../../../../examples/parallel.yaml?raw'
import subFlows from '../../../../examples/sub-flows.yaml?raw'
import createDestroy from '../../../../examples/create-destroy.yaml?raw'

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
  // First entry doubles as the Pages site's default landing flow
  // (AppFragment auto-routes to EXAMPLE_FLOWS[0] when the URL has no hash).
  {
    id: 'showcase-openhop',
    title: 'openhop',
    description: 'The self-referential hero — agent prompt → SKILL.md → CLI → playground URL.',
    path: SHOWCASE,
    yaml: showcaseOpenhop,
  },

  {
    id: 'node-icons',
    title: 'Node Icons',
    description: 'Iconify brand-icon overlays on top of pixel sprites.',
    path: EXAMPLES,
    yaml: nodeIcons,
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

  // ── Showcase: hand-authored flows visualizing real code paths in OSS projects.
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
