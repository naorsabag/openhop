# openhop

> CLI for [OpenHop](https://github.com/naorsabag/openhop) — animated data-flow diagrams your AI agent can write.

OpenHop is a SKILL-compatible skill that teaches AI coding agents (Claude Code, Cursor, Windsurf, Cline, Continue, Codex CLI, Gemini CLI, and more) how to render flows as animated pixel-art diagrams. This package is the CLI binary that powers the skill — it ships the API server, the web renderer, and the agent-facing commands all in one npm package.

## Try it in 60 seconds

```bash
npx openhop init
```

Restart your AI agent so it picks up the new skill, then ask it:

> "Walk me through the main flow of this codebase."

The agent generates the YAML, pushes it via `openhop push`, and returns a URL with the animation playing.

## Commands

```
openhop init                         # install the SKILL.md into every detected AI client
openhop serve                        # start API server on :8787 + web UI on :8788
openhop push <file.yaml>             # create a flow → returns ID + URL
openhop patch <flow-id> <file.yaml>  # apply patch operations to an existing flow
openhop list                         # list flows
openhop get <flow-id>                # fetch a flow by id
openhop remove <flow-id>             # delete a flow
openhop validate <file.yaml>         # validate YAML against the schema (no server)
openhop demo                         # boot a starter OAuth flow + open browser
```

## Documentation

Full README, install paths, use cases, and the YAML schema reference live at the repo:
**[github.com/naorsabag/openhop](https://github.com/naorsabag/openhop)**

## License

MIT © Naor Sabag
