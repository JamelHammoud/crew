import { describe, expect, it } from 'vitest'
import { breakFileLine, eraseFilePair, indentFile, pairFile } from '../src/renderer/src/components/fileEditing'

describe('file indentation', () => {
  it('puts two spaces at a caret', () => {
    expect(indentFile('const value = 1', 6, 6, false)).toEqual({
      value: 'const   value = 1',
      start: 8,
      end: 8
    })
  })

  it('indents every selected line and keeps it selected', () => {
    expect(indentFile('one\ntwo\nthree', 1, 7, false)).toEqual({
      value: '  one\n  two\nthree',
      start: 3,
      end: 11
    })
  })

  it('does not pull an unselected final line into the block', () => {
    expect(indentFile('one\ntwo\nthree', 0, 8, false)).toEqual({
      value: '  one\n  two\nthree',
      start: 2,
      end: 12
    })
  })

  it('outdents spaces and tabs without moving the caret past the line', () => {
    expect(indentFile('  one\n\ttwo', 2, 11, true)).toEqual({
      value: 'one\ntwo',
      start: 0,
      end: 8
    })
  })
})

describe('file line breaks', () => {
  it('keeps the current indentation', () => {
    expect(breakFileLine('  return value', 8, 8)).toEqual({
      value: '  return\n  value',
      start: 11,
      end: 11
    })
  })

  it('opens a brace pair with the caret on its own indented line', () => {
    expect(breakFileLine('  if (ready) {}', 14, 14)).toEqual({
      value: '  if (ready) {\n    \n  }',
      start: 19,
      end: 19
    })
  })

  it('replaces selected text with the line break', () => {
    expect(breakFileLine('  one value', 6, 11)).toEqual({
      value: '  one \n  ',
      start: 9,
      end: 9
    })
  })
})

describe('file pairs', () => {
  it('places the caret between a new pair', () => {
    expect(pairFile('call', 4, 4, '(')).toEqual({ value: 'call()', start: 5, end: 5 })
  })

  it('wraps selected text and keeps the text selected', () => {
    expect(pairFile('value', 0, 5, '"')).toEqual({ value: '"value"', start: 1, end: 6 })
  })

  it('steps over a closing mark that is already there', () => {
    expect(pairFile('call()', 5, 5, ')')).toEqual({ value: 'call()', start: 6, end: 6 })
  })

  it('erases an empty pair together', () => {
    expect(eraseFilePair('call()', 5, 5)).toEqual({ value: 'call', start: 4, end: 4 })
    expect(eraseFilePair('(value)', 1, 6)).toBeNull()
  })
})
