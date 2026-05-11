# OpenHop docs

Reference material for the people who already know what OpenHop is. If you're
new, start with the [project README](../README.md) and `npx openhop demo`.

## Contents

| Doc                                | What's in it                                                                                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| [install.md](install.md)           | Every install path — `npx openhop init`, OpenSkills, the Claude Code `/plugin` command, and the manual file-drop layout for each supported client. |
| [yaml.md](yaml.md)                 | YAML schema reference. Every step kind, every data shape, every keyword the skill is allowed to emit.                                              |
| [cli.md](cli.md)                   | Full CLI reference — every command, every flag, every exit code.                                                                                   |
| [architecture.md](architecture.md) | What runs where, why it's local-first, and the wire shape between the agent, the CLI, the API, and the web renderer.                               |

The animated playground lives at <https://naorsabag.github.io/openhop/>. It
loads the same renderer used locally — same sprites, same animation, same
inspector — but stores nothing server-side (the flow is encoded into the URL
hash). Good for sharing a snapshot without anyone installing anything.

## Conventions

- Commands prefixed with `$` are run by you. Output below is what you'd see.
- `npx openhop …` and `openhop …` are interchangeable once the package is
  installed globally or as a dev dependency. The docs use `npx` because it
  works without any prior install.
- Anything labeled **agent-facing** is what your AI coding agent emits or
  consumes — you generally don't write it by hand. The source of truth for
  the agent's contract is [`skills/openhop/SKILL.md`](../skills/openhop/SKILL.md).
