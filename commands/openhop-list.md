---
description: List every OpenHop flow currently stored on the local OpenHop server, with id, title, and per-flow URL.
allowed-tools: Bash(openhop:*) Bash(npx openhop:*) Bash(curl:*)
---

# /openhop-list

Show the user every flow that lives on their local OpenHop server.

1. **Lock in the CLI prefix.** Run `openhop --version`. If it errors, fall back to `npx openhop --version`. Use the form that worked for the rest of this command.
2. **Confirm the server is up.** `curl -s http://localhost:8787/health` should return `{"status":"ok"}`. If it does not, tell the user and offer to start it with `npx openhop serve`. Do not silently start it for `/openhop-list` — the user expects this command to be read-only.
3. **List the flows.** Run `openhop list --json` and parse the response.
4. **Render a compact table.** For each flow include:
   - `id`
   - `title` (from `meta.title`)
   - The per-flow URL: `http://localhost:8788/flow/<id>`

If the list is empty, say so and suggest `/openhop-flow <prompt>` to create the first one. Do not invent flows that are not in the response.
