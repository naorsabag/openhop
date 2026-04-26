import { Command } from 'commander'
import YAML from 'yaml'
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

/** Parsed schema-style path segment ("nodes.2.from" → ["nodes", 2, "from"]). */
type PathSegment = string | number

/** Convert a zod schema path string ("flow.nodes.0.id") into segments
 *  suitable for YAML.Document#getIn. Numeric segments become numbers so the
 *  YAML doc walker can index Sequences correctly.
 *
 *  We also accept the bracket-style paths emitted by the semantic validator
 *  (e.g. "flow.nodes[0].id") so both phases of validation map cleanly. */
export function pathStringToSegments(path: string): PathSegment[] {
  if (!path) return []
  // Normalize bracket form to dot form: "nodes[0].id" → "nodes.0.id"
  const normalized = path.replace(/\[(\d+)\]/g, '.$1').replace(/^\.+/, '')
  if (!normalized) return []
  return normalized.split('.').map((seg) => {
    const n = Number(seg)
    return Number.isInteger(n) && String(n) === seg ? n : seg
  })
}

/** Convert a 0-based byte offset to 1-based {line, col}. Walks the source
 *  counting newlines — fine for typical flow YAML sizes. */
export function offsetToLineCol(source: string, offset: number): { line: number; col: number } {
  let line = 1
  let col = 1
  const limit = Math.min(offset, source.length)
  for (let i = 0; i < limit; i++) {
    if (source.charCodeAt(i) === 10 /* \n */) {
      line++
      col = 1
    } else {
      col++
    }
  }
  return { line, col }
}

/** Best-effort line/col lookup for a schema path against a parsed YAML doc.
 *  Returns undefined when the path can't be resolved (synthesized errors,
 *  out-of-range indices, etc) — caller should treat that as "unknown". */
export function resolvePosition(
  doc: YAML.Document.Parsed,
  source: string,
  path: PathSegment[]
): { line: number; col: number } | undefined {
  if (path.length === 0) {
    // Whole-document error → point at the first non-whitespace character.
    const m = source.match(/\S/)
    return m ? offsetToLineCol(source, m.index ?? 0) : { line: 1, col: 1 }
  }
  // Try the full path first, then progressively shorter prefixes — this lets
  // us land on the parent container when the leaf doesn't exist (e.g. a
  // missing required field).
  for (let i = path.length; i >= 0; i--) {
    const sub = path.slice(0, i)
    let node: unknown
    try {
      node = sub.length === 0 ? doc.contents : doc.getIn(sub, true)
    } catch {
      node = undefined
    }
    if (node && typeof node === 'object' && 'range' in node) {
      const range = (node as { range?: [number, number, number] | null }).range
      if (range && typeof range[0] === 'number') {
        return offsetToLineCol(source, range[0])
      }
    }
  }
  return undefined
}

/** Register `openhop validate <file|->` — local schema validation, no server.
 *  Top-level command (not a side-effect of push) so agents can iterate locally.
 *
 *  Position mapping: we keep `parseFlowYaml` from @openhop/shared unchanged
 *  (it's also used by push/patch and they don't care about source positions).
 *  Instead, validate.ts re-parses the YAML with `YAML.parseDocument` to keep
 *  the CST around, then walks it per-error to attach {line, col}. This is
 *  Option C from the spec: localized to the only command that needs it. */
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

      // Build a positional doc for line/col mapping. If the YAML is so broken
      // that even parseDocument throws, fall back to undefined positions —
      // the error from parseFlowYaml still flows through.
      let doc: YAML.Document.Parsed | undefined
      try {
        doc = YAML.parseDocument(yamlContent)
      } catch {
        doc = undefined
      }

      const enriched = result.errors.map((e) => {
        let line: number | undefined
        let col: number | undefined
        if (doc) {
          const segs = pathStringToSegments(e.path)
          const pos = resolvePosition(doc, yamlContent, segs)
          if (pos) {
            line = pos.line
            col = pos.col
          }
        }
        return {
          path: e.path,
          line,
          col,
          message: e.message,
          ...(e.suggestion ? { suggestion: e.suggestion } : {}),
        }
      })

      if (opts.json) {
        emitJson({ valid: false, errors: enriched })
      } else {
        errStderr(red('✗ Validation errors:'))
        for (const err of enriched) {
          const suggestion = err.suggestion ? ` ${err.suggestion}` : ''
          const loc =
            err.line !== undefined && err.col !== undefined
              ? `${err.path}:${err.line}:${err.col}:`
              : `${err.path}:`
          errStderr(`  ${dim(loc)} ${err.message}${suggestion}`)
        }
      }
      process.exit(ExitCode.VALIDATION)
    })
}
