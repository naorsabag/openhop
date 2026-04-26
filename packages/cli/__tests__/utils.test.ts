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
  it('wraps text in the matching ANSI codes', () => {
    expect(green('ok')).toBe('\x1b[32mok\x1b[0m')
    expect(red('err')).toBe('\x1b[31merr\x1b[0m')
    expect(bold('B')).toBe('\x1b[1mB\x1b[0m')
    expect(dim('D')).toBe('\x1b[2mD\x1b[0m')
    expect(cyan('C')).toBe('\x1b[36mC\x1b[0m')
  })
})
