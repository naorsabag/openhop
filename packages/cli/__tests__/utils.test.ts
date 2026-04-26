import { describe, it, expect } from 'vitest'
import { errorMessage, padRight, green, red, bold, dim, cyan } from '../src/utils'

describe('errorMessage', () => {
  it('returns the message for Error instances', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
  })

  it('returns the message for thrown subclasses', () => {
    class MyError extends Error {
      constructor() {
        super('custom')
      }
    }
    expect(errorMessage(new MyError())).toBe('custom')
  })

  it('stringifies non-Error throws', () => {
    expect(errorMessage('string thrown')).toBe('string thrown')
    expect(errorMessage(42)).toBe('42')
    expect(errorMessage(null)).toBe('null')
    expect(errorMessage(undefined)).toBe('undefined')
    expect(errorMessage({ unusual: 'object' })).toBe('[object Object]')
  })
})

describe('padRight', () => {
  it('pads short strings with spaces to the requested width', () => {
    expect(padRight('abc', 6)).toBe('abc   ')
  })

  it('returns the input unchanged when already at the width', () => {
    expect(padRight('abcdef', 6)).toBe('abcdef')
  })

  it('truncates strings longer than the width', () => {
    expect(padRight('abcdefghij', 4)).toBe('abcd')
  })

  it('handles zero-width by truncating to nothing', () => {
    expect(padRight('abc', 0)).toBe('')
  })

  it('handles empty input', () => {
    expect(padRight('', 3)).toBe('   ')
  })
})

describe('color helpers', () => {
  // In a non-TTY environment (vitest spawns without a tty on stderr), the
  // helpers are no-ops by design — output discipline says no ANSI in piped
  // output. We verify the no-op path here; the wrapped path is exercised
  // implicitly by snapshot tests that run under a real terminal.
  it('passes input through unchanged when stderr is not a TTY', () => {
    expect(green('ok')).toBe('ok')
    expect(red('err')).toBe('err')
    expect(bold('B')).toBe('B')
    expect(dim('D')).toBe('D')
    expect(cyan('C')).toBe('C')
  })
})
