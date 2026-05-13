# Showcase flows

Hand-authored OpenHop flows for well-known open-source projects, plus a self-referential
flow of OpenHop itself. Each flow visualizes a *real* code path in the target repo — not
a marketing diagram — so anyone who already uses the project gets the "huh, didn't realize
it worked that way" reaction.

These ship in the repo for two reasons:

1. **First-impression demos.** Visitors who land on the repo can `openhop push examples/showcase/<repo>.yaml`
   and immediately see the tool render a flow they recognize.
2. **Reference flows for AI agents.** The agent following [`skills/openhop/SKILL.md`](../../skills/openhop/SKILL.md)
   can read these to learn the YAML conventions on non-trivial flows (broadcast `to`, parallel
   steps, drill-down sub-flows, `external` vs `service` distinction).

The companion launch-side strategy doc — which one to publish when, in which channel — lives
in [`openhop-launch/21-case-study-flows.md`](https://github.com/naorsabag/openhop-launch/blob/main/21-case-study-flows.md).
Shipped inventory + license verification lives in [`openhop-launch/22-shipped-example-flows.md`](https://github.com/naorsabag/openhop-launch/blob/main/22-shipped-example-flows.md).

## Files

| File | Target | License | Flow visualized |
|---|---|---|---|
| [`openhop.yaml`](./openhop.yaml) | this repo | MIT | The self-referential hero — agent prompt → SKILL.md → CLI → playground URL → animation |
| [`langgraph.yaml`](./langgraph.yaml) | langchain-ai/langgraph | MIT | Agent state graph: START → agent node → conditional edge → tool node → END |
| [`openai-codex.yaml`](./openai-codex.yaml) | openai/codex | Apache-2.0 | Codex CLI tool-call loop: prompt → model → tool selection → execution → output |
| [`block-goose.yaml`](./block-goose.yaml) | block/goose | Apache-2.0 | Goose MCP + skills loop: prompt → goose core → MCP client → MCP server → reply |
| [`authjs-oauth.yaml`](./authjs-oauth.yaml) | nextauthjs/next-auth | ISC | OAuth 2.0 PKCE end-to-end: browser → app → provider → callback → token exchange |
| [`openclaw.yaml`](./openclaw.yaml) | openclaw/openclaw | MIT | Agent loop: prompt → skill router → tool call → tool response → reply |
| [`vercel-ai-sdk.yaml`](./vercel-ai-sdk.yaml) | vercel/ai | Apache-2.0 | useChat → /api/chat → streamText → tool call → tool exec → SSE data stream → UI re-render |
| [`browser-use.yaml`](./browser-use.yaml) | browser-use/browser-use | MIT | Agent step: DOM tree + screenshot → LLM → typed action → Playwright → page state → loop |

## Running one

```bash
# Validate locally (no server required):
openhop validate examples/showcase/langgraph.yaml

# Push and get a shareable URL:
openhop push examples/showcase/langgraph.yaml --json
```

## Authoring conventions used here

- **Labels are short.** ≤4 words so they fit the fixed-width label slot.
- **`type` is a category, not a name.** `database` not `postgres`; the label carries the name.
- **`external` for things outside the runtime data path.** Humans, third-party identity providers,
  end-user browsers visiting from the open internet.
- **Data is a plain string** unless a field list adds real information. Don't pad with synthetic
  schemas — readers feel the noise.
- **Drill-downs sparingly.** At most one `drilldown: true` per flow; chained drilldowns disorient
  during animation playback.

## Adding a new one

1. **Read the actual source first.** Don't visualize from memory — that's how a "that's not how
   X works" derail starts on launch day.
2. Match the schema in [`docs/yaml.md`](../../docs/yaml.md) — the zod schema in
   [`packages/shared/src/schema.ts`](../../packages/shared/src/schema.ts) is the source of truth.
3. Verify with `openhop validate examples/showcase/<file>.yaml`.
4. Confirm the target repo's license is OSS (MIT / Apache / BSD / ISC). Source-available or
   no-license repos don't ship here — see the anti-picks list in
   [21-case-study-flows.md](https://github.com/naorsabag/openhop-launch/blob/main/21-case-study-flows.md).
5. Update the table above and the inventory doc in `openhop-launch/`.
