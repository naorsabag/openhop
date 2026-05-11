# Install

Three install paths, picked by which AI client you use.

## Path A — `npx openhop init` (auto-detect)

The shortest happy path. Auto-detects every Tier-1 AI client on your machine
and drops the `SKILL.md` into the right place.

```bash
npx openhop init
```

Supported by `init`:

| Client             | Skills directory                      | Notes                                                                                                                                           |
| ------------------ | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code        | `~/.claude/skills/openhop/`           | Native.                                                                                                                                         |
| Cursor (v2.4+)     | `~/.cursor/skills/openhop/`           | Native. Also auto-discovers `~/.agents/skills/`.                                                                                                |
| Windsurf (Cascade) | `~/.codeium/windsurf/skills/openhop/` | Native.                                                                                                                                         |
| Cline (3.48+)      | `~/.cline/skills/openhop/`            | Requires one-time toggle: **VS Code → Settings → Cline → Features → Enable Skills (experimental)**.                                             |
| Continue.dev       | (advisory)                            | No native skills surface; the rules system at `~/.continue/rules/` is too small for a full `SKILL.md`. Tracked for a condensed-rule translator. |

Flags: see [cli.md#openhop-init](cli.md#openhop-init).

## Path B — OpenSkills (cross-vendor universal installer)

For any client `npx openhop init` doesn't know about.

```bash
npx openskills install naorsabag/openhop
```

[OpenSkills](https://github.com/numman-ali/openskills) knows every client's
skills directory and drops the file in the right place. Covers Codex CLI,
Gemini CLI, Junie, GitHub Copilot, OpenCode, Goose, Antigravity, and more.

After OpenSkills places the skill, also run `npx openhop init` so the CLI
machinery the skill calls into is installed locally. `init` skips the skill
copy if OpenSkills already wrote it.

## Path C — plugin install

```text
/plugin install naorsabag/openhop
```

…or from your agent GUI.

## Manual / advisory clients

For clients with no published skills directory (or where the convention is
still in flux), the install is "drop `SKILL.md` somewhere the agent reads
from and re-launch". The directories above are the conventions we ship to.

If you've installed OpenHop somewhere not listed here and it works, open a
PR adding the client to [`packages/cli/src/init.ts:buildClients`](../packages/cli/src/init.ts).

## What gets installed

Just `skills/openhop/SKILL.md` (plus its small assets). The CLI + server +
web renderer ship as the same `openhop` npm package and the agent boots them
on demand the first time you ask for a flow — they don't need to be
pre-installed.

To pre-install everything:

```bash
npm install -g openhop
```

…but `npx` works without it.
