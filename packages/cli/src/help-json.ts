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
  examples?: string[]
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

  return {
    description: cmd.description(),
    positional,
    flags,
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
