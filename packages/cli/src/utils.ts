/** Small formatting / I/O helpers used by the CLI commands. Extracted so they
 *  can be unit-tested without spawning a subprocess. */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Read input from a file path or stdin (use "-" for stdin). */
export function readInput(file: string): string {
  if (file === '-') {
    return readFileSync(0, 'utf-8') // fd 0 = stdin
  }
  return readFileSync(resolve(file), 'utf-8')
}

/** Stringify an arbitrary thrown value for user-facing error reports. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** Pad a string with trailing spaces; truncates if longer than `len`. */
export function padRight(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length)
}

// ---------------------------------------------------------------------------
// ANSI color helpers — no-op when stdout/stderr is piped or NO_COLOR is set.
// We check stderr for color decisions because that's where human messaging
// goes; data on stdout must always be plain (especially in --json mode).
// ---------------------------------------------------------------------------

const noColor =
  process.env.NO_COLOR !== undefined ||
  process.env.TERM === 'dumb' ||
  !process.stderr.isTTY

const ansi = (open: number, close: number) => (s: string) =>
  noColor ? s : `\x1b[${open}m${s}\x1b[${close}m`

export const green = ansi(32, 39)
export const red = ansi(31, 39)
export const bold = ansi(1, 22)
export const dim = ansi(2, 22)
export const cyan = ansi(36, 39)

// ---------------------------------------------------------------------------
// Output discipline: data on stdout, logs/errors on stderr.
// ---------------------------------------------------------------------------

/** Emit a JSON document on stdout (machine-readable mode). */
export function emitJson(value: unknown): void {
  process.stdout.write(JSON.stringify(value) + '\n')
}

/** Emit a human-readable line on stderr (logs, status, progress). */
export function logStderr(line: string): void {
  process.stderr.write(line + '\n')
}

/** Emit an error line on stderr. */
export function errStderr(line: string): void {
  process.stderr.write(line + '\n')
}
