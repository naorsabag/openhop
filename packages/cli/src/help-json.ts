import { Command, Option } from 'commander'
import { emitJson } from './utils.js'
import { ExitCode } from './exit-codes.js'

interface FlagSpec {
  name: string
  type: string
  description: string
  default?: unknown
  required?: boolean
}

interface PositionalSpec {
  name: string
  type: 'string' | 'path-or-dash'
  required: boolean
  variadic: boolean
}

interface CommandSpec {
  description: string
  positional: PositionalSpec[]
  flags: FlagSpec[]
  /** Exit codes this specific command can produce. Subset of the global
   *  exitCodes map. Agents read this to know which failure modes to plan
   *  for without trying every code. */
  exitCodes: number[]
  /** Realistic invocation examples for this command. */
  examples: string[]
}

interface HelpDoc {
  name: string
  version: string
  apiVersion: number
  exitCodes: Record<string, number>
  commands: Record<string, CommandSpec>
}

const FLAG_TYPE_HINTS: Record<string, string> = {
  '--json': 'bool',
  '--api-version': 'bool',
  '-s, --server <url>': 'string',
  '-p, --port <port>': 'string',
  '--format <format>': 'string',
  '--output <path>': 'string',
  '--client <name>': 'string',
  '--force': 'bool',
  '--dry-run': 'bool',
}

function flagType(opt: Option): string {
  const flags = opt.flags
  if (FLAG_TYPE_HINTS[flags]) return FLAG_TYPE_HINTS[flags]
  if (flags.includes('<')) return 'string'
  return 'bool'
}

function positionalType(name: string): 'string' | 'path-or-dash' {
  if (name === 'file') return 'path-or-dash'
  return 'string'
}

/** Per-command metadata that isn't derivable from Commander introspection.
 *  When a new command is added, append an entry here so `help --json` keeps
 *  surfacing actionable information for agents. */
const COMMAND_META: Record<string, { exitCodes: number[]; examples: string[] }> = {
  serve: {
    exitCodes: [ExitCode.SUCCESS, ExitCode.GENERIC],
    examples: ['openhop serve', 'openhop serve --port 8800'],
  },
  push: {
    exitCodes: [
      ExitCode.SUCCESS,
      ExitCode.USAGE,
      ExitCode.VALIDATION,
      ExitCode.CONFLICT,
      ExitCode.NETWORK,
    ],
    examples: [
      'openhop push flow.yaml',
      'openhop push flow.yaml --json',
      'cat flow.yaml | openhop push -',
    ],
  },
  list: {
    exitCodes: [ExitCode.SUCCESS, ExitCode.NETWORK],
    examples: ['openhop list', 'openhop list --json'],
  },
  get: {
    exitCodes: [ExitCode.SUCCESS, ExitCode.USAGE, ExitCode.NOT_FOUND, ExitCode.NETWORK],
    examples: ['openhop get abc123', 'openhop get abc123 --json'],
  },
  patch: {
    exitCodes: [
      ExitCode.SUCCESS,
      ExitCode.USAGE,
      ExitCode.VALIDATION,
      ExitCode.NOT_FOUND,
      ExitCode.CONFLICT,
      ExitCode.NETWORK,
    ],
    examples: ['openhop patch abc123 patch.yaml', 'cat patch.yaml | openhop patch abc123 -'],
  },
  remove: {
    exitCodes: [ExitCode.SUCCESS, ExitCode.USAGE, ExitCode.NOT_FOUND, ExitCode.NETWORK],
    examples: ['openhop remove abc123', 'openhop remove abc123 --json'],
  },
  validate: {
    exitCodes: [ExitCode.SUCCESS, ExitCode.USAGE, ExitCode.VALIDATION],
    examples: [
      'openhop validate flow.yaml',
      'openhop validate flow.yaml --json',
      'cat flow.yaml | openhop validate -',
    ],
  },
  init: {
    exitCodes: [ExitCode.SUCCESS, ExitCode.GENERIC, ExitCode.USAGE],
    examples: [
      'openhop init',
      'openhop init --dry-run --json',
      'openhop init --client claude-code',
      'openhop init --force',
    ],
  },
}

const HELP_META = {
  exitCodes: [ExitCode.SUCCESS, ExitCode.NOT_FOUND],
  examples: ['openhop help --json', 'openhop help push --json'],
}

function commandSpec(cmd: Command): CommandSpec {
  const positional: PositionalSpec[] = cmd.registeredArguments.map((arg) => ({
    name: arg.name(),
    type: positionalType(arg.name()),
    required: arg.required,
    variadic: arg.variadic,
  }))

  const flags: FlagSpec[] = cmd.options.map((opt) => ({
    name: opt.long ?? opt.short ?? opt.flags,
    type: flagType(opt),
    description: opt.description,
    ...(opt.defaultValue !== undefined ? { default: opt.defaultValue } : {}),
    ...(opt.required ? { required: true } : {}),
  }))

  const meta = cmd.name() === 'help' ? HELP_META : COMMAND_META[cmd.name()]

  return {
    description: cmd.description(),
    positional,
    flags,
    exitCodes: meta?.exitCodes ?? [ExitCode.SUCCESS, ExitCode.GENERIC],
    examples: meta?.examples ?? [],
  }
}

/** Register `openhop help --json` — emit a parseable command tree.
 *  Per spec, agents call this to plan invocations without docs. */
export function registerHelpJson(program: Command, apiVersion: number): void {
  program
    .command('help [command]')
    .description('Show help. With --json, emit a parseable command tree.')
    .option('--json', 'Emit JSON on stdout (machine-readable)')
    .action((commandName: string | undefined, opts) => {
      if (!opts.json) {
        if (commandName) {
          const sub = program.commands.find((c) => c.name() === commandName)
          if (sub) sub.help()
          else program.help()
        } else {
          program.help()
        }
        return
      }

      const subcommands = program.commands.filter((c) => c.name() !== 'help')

      const doc: HelpDoc = {
        name: program.name(),
        version: program.version() ?? '0.0.0',
        apiVersion,
        exitCodes: {
          SUCCESS: ExitCode.SUCCESS,
          GENERIC: ExitCode.GENERIC,
          USAGE: ExitCode.USAGE,
          VALIDATION: ExitCode.VALIDATION,
          NOT_FOUND: ExitCode.NOT_FOUND,
          CONFLICT: ExitCode.CONFLICT,
          NETWORK: ExitCode.NETWORK,
          AUTH: ExitCode.AUTH,
        },
        commands: {},
      }

      if (commandName) {
        const sub = subcommands.find((c) => c.name() === commandName)
        if (!sub) {
          emitJson({ ok: false, error: 'not-found', command: commandName })
          process.exit(ExitCode.NOT_FOUND)
        }
        doc.commands[sub.name()] = commandSpec(sub)
      } else {
        for (const sub of subcommands) {
          doc.commands[sub.name()] = commandSpec(sub)
        }
      }

      emitJson(doc)
    })
}
