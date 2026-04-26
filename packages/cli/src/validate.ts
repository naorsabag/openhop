import { Command } from 'commander'
import { parseFlowYaml } from '@openhop/shared'
import {
  readInput,
  errorMessage,
  dim,
  green,
  red,
  emitJson,
  errStderr,
  logStderr,
} from './utils.js'
import { ExitCode } from './exit-codes.js'

/** Register `openhop validate <file|->` — local schema validation, no server.
 *  Top-level command (not a side-effect of push) so agents can iterate locally. */
export function registerValidate(program: Command): void {
  program
    .command('validate <file>')
    .description('Validate a YAML flow against the schema (use - for stdin)')
    .option('--json', 'Emit JSON on stdout (machine-readable)')
    .action((file: string, opts) => {
      let yamlContent: string
      try {
        yamlContent = readInput(file)
      } catch (err) {
        if (opts.json) emitJson({ valid: false, error: 'read', message: errorMessage(err) })
        else errStderr(red(`✗ Read error: ${errorMessage(err)}`))
        process.exit(ExitCode.USAGE)
        return
      }

      const result = parseFlowYaml(yamlContent)

      if (result.success) {
        if (opts.json) emitJson({ valid: true })
        else logStderr(green('✓ Valid flow'))
        process.exit(ExitCode.SUCCESS)
        return
      }

      if (opts.json) {
        emitJson({
          valid: false,
          errors: result.errors.map((e) => ({
            path: e.path,
            message: e.message,
            suggestion: e.suggestion,
          })),
        })
      } else {
        errStderr(red('✗ Validation errors:'))
        for (const err of result.errors) {
          const suggestion = err.suggestion ? ` ${err.suggestion}` : ''
          errStderr(`  ${dim(err.path + ':')} ${err.message}${suggestion}`)
        }
      }
      process.exit(ExitCode.VALIDATION)
    })
}
