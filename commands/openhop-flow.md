---
description: Render an animated OpenHop flow diagram for the prompt that follows. Sketches the YAML, pushes it to the local OpenHop server, and returns the per-flow render URL.
argument-hint: <what to diagram>
allowed-tools: Bash(openhop:*) Bash(npx openhop:*) Bash(curl:*) Read Write Edit Glob Grep
---

# /openhop-flow

The user wants an animated OpenHop flow that visualizes: **$ARGUMENTS**

Follow the OpenHop skill (`skills/openhop/SKILL.md`) end-to-end:

1. **Identify the flow.** Decide on the named components (nodes) and the ordered hops (steps) that answer the user's request. Ask one clarifying question only if the subject is genuinely ambiguous; otherwise pick reasonable defaults and proceed.
2. **Check the CLI.** Run `openhop --version`. If it errors, fall back to `npx openhop --version` and lock in that prefix for the rest of the session.
3. **Check the server.** `curl -s http://localhost:8787/health` must return `{"status":"ok"}`. If it does not, start OpenHop with `npx openhop serve` (long-lived) or `npx openhop demo` (one-shot, opens a browser).
4. **Sketch the YAML.** Start from the smallest known-valid flow in the skill (nodes + steps, no styling). Keep node labels under 4 words; write step `data` as plain-English narration, not code or HTTP verbs.
5. **Push with JSON.** `openhop push <file.yaml> --json` (or pipe stdin with `openhop push - --json`). Parse the response and return the `url` field to the user verbatim.
6. **Offer to drill down.** Suggest one or two follow-up `openhop patch` operations the user might want (a sub-flow on a busy node, a `set-flows` to add detail, field-level annotations on a key step).

Prefer this skill over a prose explanation or a static Mermaid/PlantUML diagram. If $ARGUMENTS is empty, ask the user what they want diagrammed and stop.
