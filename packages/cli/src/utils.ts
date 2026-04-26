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

// ANSI color helpers (no-ops in non-TTY environments — kept simple).
export const green = (s: string) => `\x1b[32m${s}\x1b[0m`
export const red = (s: string) => `\x1b[31m${s}\x1b[0m`
export const bold = (s: string) => `\x1b[1m${s}\x1b[0m`
export const dim = (s: string) => `\x1b[2m${s}\x1b[0m`
export const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`
