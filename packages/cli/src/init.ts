/**
 * `openhop init` — installs the OpenHop skill into every detected AI client
 * on the user's machine.
 *
 * Spec: openhop-launch/17-install-and-activation-flow.md
 *       openhop-launch/16-cli-as-universal-api.md
 *
 * Skills-only policy: we ship ONE SKILL.md. This command copies the bundled
 * `skills/openhop/` tree into each client's per-user skills directory. No
 * per-client skill variants exist.
 *
 * Output discipline: data on stdout, logs/errors on stderr. `--json` emits a
 * single summary object. Non-interactive: no TTY prompts. Default skips on
 * existing destinations; use `--force` to overwrite.
 */

import { Command } from 'commander'
import { existsSync, statSync, cpSync, mkdirSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Local exit-code constants. Match the contract in 16-cli-as-universal-api.md;
// kept local until a shared exit-code module lands.
const EXIT_OK = 0
const EXIT_GENERIC = 1
const EXIT_USAGE = 2

/** A supported AI client and where it expects skills on this machine. */
export interface ClientSpec {
  /** Stable id used for --client filtering and JSON output. */
  id: string
  /** Display name. */
  label: string
  /**
   * Returns the directory we check to detect the client (typically the client's
   * config root). If it exists, the client is "detected".
   */
  detectDir: () => string
  /**
   * Returns the directory to install the skill into (the parent skills dir;
   * we create `<skillsDir>/openhop/` underneath it).
   */
  skillsDir: () => string
  /**
   * Some clients have uncertain conventions; for these we don't write — we
   * print a manual instruction in human mode and mark "advisory" in JSON.
   */
  advisory?: boolean
  /** Notes to print/emit when advisory. */
  advisoryNote?: string
}

/**
 * Build the per-OS client list. Paths are sourced primarily from
 * 17-install-and-activation-flow.md ("Client-specific install variants" table)
 * and confirmed against each project's docs at time of writing (April 2026).
 *
 * Sources:
 *  - Claude Code: https://docs.anthropic.com/en/docs/claude-code/skills
 *      → ~/.claude/skills/<name>/
 *  - Cursor: https://docs.cursor.com (rules live under .cursor/rules; the
 *      community skills convention is .cursor/skills/<name>/, used by
 *      `cursor-anthropic-skills`). Spec table: `.cursor/skills/openhop/`.
 *  - Windsurf (Cascade): per spec table — `.windsurf/skills/openhop/`. Path
 *      is project-local in current Windsurf docs; the global ~/.windsurf
 *      convention is community-driven, so we mark advisory.
 *  - Cline: per spec table — `.cline/skills/openhop/`. Cline reads skills
 *      from a workspace dir; global path is community-driven → advisory.
 *  - Continue.dev: ~/.continue/ exists per https://docs.continue.dev. Skill
 *      registration is via Continue Hub blocks rather than file copy, so we
 *      mark advisory and print a manual hint.
 */
export function buildClients(home: string = homedir(), os: string = platform()): ClientSpec[] {
  // For v0.1 we use POSIX-style ~/.<client>/ on every OS; this matches the
  // documented Claude Code path and is consistent with how the other clients
  // namespace their config on Windows (under %USERPROFILE%) and macOS/Linux
  // (under $HOME). os.homedir() handles the platform difference for us.
  void os // reserved for future per-OS branching (e.g. AppData on Windows)

  return [
    {
      id: 'claude-code',
      label: 'Claude Code',
      detectDir: () => join(home, '.claude'),
      skillsDir: () => join(home, '.claude', 'skills'),
    },
    {
      id: 'cursor',
      label: 'Cursor',
      detectDir: () => join(home, '.cursor'),
      skillsDir: () => join(home, '.cursor', 'skills'),
    },
    {
      id: 'windsurf',
      label: 'Windsurf',
      detectDir: () => join(home, '.windsurf'),
      skillsDir: () => join(home, '.windsurf', 'skills'),
      advisory: true,
      advisoryNote:
        'Windsurf uses workspace-local skills today; copy skills/openhop/ into <project>/.windsurf/skills/.',
    },
    {
      id: 'cline',
      label: 'Cline',
      detectDir: () => join(home, '.cline'),
      skillsDir: () => join(home, '.cline', 'skills'),
      advisory: true,
      advisoryNote:
        'Cline reads skills from the active workspace; copy skills/openhop/ into <project>/.cline/skills/.',
    },
    {
      id: 'continue',
      label: 'Continue.dev',
      detectDir: () => join(home, '.continue'),
      skillsDir: () => join(home, '.continue', 'skills'),
      advisory: true,
      advisoryNote:
        'Continue uses Hub blocks, not skill directories; install the OpenHop block from Continue Hub instead.',
    },
  ]
}

export interface InstallResult {
  client: string
  status: 'installed' | 'skipped' | 'failed' | 'advisory' | 'would-install'
  path?: string
  reason?: string
}

export interface InitOptions {
  json?: boolean
  force?: boolean
  dryRun?: boolean
  client?: string
}

/**
 * File-system surface we depend on. Splitting this out makes the install
 * logic trivially mockable in tests without `vi.mock('node:fs')`.
 */
export interface FsLike {
  existsSync: (p: string) => boolean
  statSync: (p: string) => { isDirectory: () => boolean }
  cpSync: (src: string, dest: string, opts: { recursive: true; force: boolean }) => void
  mkdirSync: (p: string, opts: { recursive: true }) => void
}

const realFs: FsLike = {
  existsSync,
  statSync,
  cpSync: (src, dest, opts) => cpSync(src, dest, opts),
  mkdirSync: (p, opts) => {
    mkdirSync(p, opts)
  },
}

/**
 * Locate the bundled skills/openhop/ directory. At dev time it sits at the
 * monorepo root; in the published npm package it sits next to dist/. We try
 * a few likely locations and return the first that exists.
 */
export function findSourceSkill(
  startUrl: string = import.meta.url,
  fs: FsLike = realFs,
  cwd: string = process.cwd(),
): string | null {
  const here = dirname(fileURLToPath(startUrl))
  const candidates = [
    // dev: packages/cli/src → repo root
    resolve(here, '..', '..', '..', 'skills', 'openhop'),
    // built: packages/cli/dist → repo root
    resolve(here, '..', '..', '..', 'skills', 'openhop'),
    // published: <pkg>/dist → <pkg>/skills (we'd ship them inside the package)
    resolve(here, '..', 'skills', 'openhop'),
    resolve(here, 'skills', 'openhop'),
    // fallback: invoked from a checkout
    resolve(cwd, 'skills', 'openhop'),
  ]
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isDirectory()) return c
  }
  return null
}

/** Pure planning + execution function, exposed for testing. */
export function runInit(
  opts: InitOptions,
  clients: ClientSpec[],
  sourceSkill: string | null,
  fs: FsLike = realFs,
): { results: InstallResult[]; sourceMissing: boolean } {
  if (!sourceSkill) {
    return { results: [], sourceMissing: true }
  }

  const filtered = opts.client ? clients.filter((c) => c.id === opts.client) : clients
  const results: InstallResult[] = []

  for (const c of filtered) {
    if (!fs.existsSync(c.detectDir())) {
      results.push({ client: c.id, status: 'skipped', reason: 'not detected' })
      continue
    }

    if (c.advisory) {
      results.push({
        client: c.id,
        status: 'advisory',
        reason: c.advisoryNote ?? 'manual install required',
        path: c.skillsDir(),
      })
      continue
    }

    const dest = join(c.skillsDir(), 'openhop')
    const exists = fs.existsSync(dest)

    if (exists && !opts.force) {
      results.push({
        client: c.id,
        status: 'skipped',
        reason: 'already installed (use --force to overwrite)',
        path: dest,
      })
      continue
    }

    if (opts.dryRun) {
      results.push({ client: c.id, status: 'would-install', path: dest })
      continue
    }

    try {
      fs.mkdirSync(c.skillsDir(), { recursive: true })
      fs.cpSync(sourceSkill, dest, { recursive: true, force: !!opts.force })
      results.push({ client: c.id, status: 'installed', path: dest })
    } catch (err) {
      results.push({
        client: c.id,
        status: 'failed',
        path: dest,
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { results, sourceMissing: false }
}

/** Render results as a small fixed-width table. Pure function; testable. */
export function renderTable(results: InstallResult[]): string {
  const rows = [
    ['Client', 'Status', 'Path'],
    ['------', '------', '----'],
    ...results.map((r) => [r.client, r.status, r.path ?? r.reason ?? '']),
  ]
  const widths = [0, 1, 2].map((i) => Math.max(...rows.map((r) => r[i].length)))
  return rows.map((r) => r.map((cell, i) => cell.padEnd(widths[i] + 2)).join('')).join('\n')
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length)
}
void pad // unused but kept for clarity if formatter logic expands

export function registerInit(program: Command): void {
  program
    .command('init')
    .description('Install the OpenHop skill into every detected AI client')
    .option('--json', 'Emit a single JSON summary on stdout')
    .option('--force', 'Overwrite an existing SKILL.md if present')
    .option('--dry-run', 'Print what would be done without writing')
    .option('--client <name>', 'Install only into the named client (e.g. claude-code)')
    .action((opts: InitOptions) => {
      const clients = buildClients()

      // Validate --client filter early so we can return exit 2 (usage error).
      if (opts.client && !clients.some((c) => c.id === opts.client)) {
        const known = clients.map((c) => c.id).join(', ')
        process.stderr.write(
          `error: unknown --client "${opts.client}". Known clients: ${known}\n`,
        )
        process.exit(EXIT_USAGE)
      }

      const sourceSkill = findSourceSkill()
      const { results, sourceMissing } = runInit(opts, clients, sourceSkill)

      if (sourceMissing) {
        process.stderr.write(
          'error: could not locate bundled skills/openhop/ — is this a damaged install?\n',
        )
        process.exit(EXIT_GENERIC)
      }

      const installed = results.filter((r) => r.status === 'installed')
      const skipped = results.filter((r) => r.status === 'skipped' || r.status === 'advisory')
      const failed = results.filter((r) => r.status === 'failed')
      const wouldInstall = results.filter((r) => r.status === 'would-install')

      if (opts.json) {
        const payload = {
          installed: installed.map((r) => ({ client: r.client, path: r.path })),
          skipped: skipped.map((r) => ({ client: r.client, reason: r.reason })),
          failed: failed.map((r) => ({ client: r.client, reason: r.reason })),
          wouldInstall: wouldInstall.map((r) => ({ client: r.client, path: r.path })),
          dryRun: !!opts.dryRun,
        }
        process.stdout.write(JSON.stringify(payload) + '\n')
      } else {
        process.stderr.write(renderTable(results) + '\n')
        for (const r of results) {
          if (r.status === 'advisory' && r.reason) {
            process.stderr.write(`  note (${r.client}): ${r.reason}\n`)
          }
        }
      }

      // Exit code policy: success if anything was installed (or, in dry-run,
      // would have been installed). Otherwise generic failure when nothing
      // was actionable.
      const anySuccess = installed.length > 0 || wouldInstall.length > 0
      if (!anySuccess && installed.length === 0 && wouldInstall.length === 0) {
        process.exit(EXIT_GENERIC)
      }
      process.exit(EXIT_OK)
    })
}
