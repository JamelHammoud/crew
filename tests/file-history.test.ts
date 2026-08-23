import { describe, expect, it } from 'vitest'
import {
  createFileHistory,
  recordFileEdit,
  redoFileEdit,
  undoFileEdit,
  type FileSelection,
  type FileSnapshot
} from '../src/renderer/src/components/fileHistory'

const caret = (at: number): FileSelection => ({ start: at, end: at, direction: 'none' })
const snapshot = (text: string, selection = caret(text.length)): FileSnapshot => ({ text, selection })

describe('file edit history', () => {
  it('takes a continuous run of typing out and puts it back as one step', () => {
    const history = createFileHistory()
    recordFileEdit(history, snapshot(''), snapshot('a'), 'type', 0)
    recordFileEdit(history, snapshot('a'), snapshot('ab'), 'type', 100)
    recordFileEdit(history, snapshot('ab'), snapshot('abc'), 'type', 200)

    expect(undoFileEdit(history, 'abc')).toEqual(snapshot('', caret(0)))
    expect(redoFileEdit(history, '')).toEqual(snapshot('abc'))
  })

  it('starts another step after a pause or a caret move', () => {
    const history = createFileHistory()
    recordFileEdit(history, snapshot(''), snapshot('a'), 'type', 0)
    recordFileEdit(history, snapshot('a'), snapshot('ab'), 'type', 1200)
    expect(undoFileEdit(history, 'ab')?.text).toBe('a')

    const moved = createFileHistory()
    recordFileEdit(moved, snapshot('ac', caret(1)), snapshot('abc', caret(2)), 'type', 0)
    recordFileEdit(moved, snapshot('abc', caret(0)), snapshot('xabc', caret(1)), 'type', 100)
    expect(undoFileEdit(moved, 'xabc')?.text).toBe('abc')
    expect(undoFileEdit(moved, 'abc')?.text).toBe('ac')
  })

  it('groups repeated backward and forward deletes', () => {
    const backward = createFileHistory()
    recordFileEdit(backward, snapshot('abcd'), snapshot('abc'), 'delete-backward', 0)
    recordFileEdit(backward, snapshot('abc'), snapshot('ab'), 'delete-backward', 100)
    expect(undoFileEdit(backward, 'ab')?.text).toBe('abcd')

    const forward = createFileHistory()
    recordFileEdit(forward, snapshot('abcd', caret(1)), snapshot('acd', caret(1)), 'delete-forward', 0)
    recordFileEdit(forward, snapshot('acd', caret(1)), snapshot('ad', caret(1)), 'delete-forward', 100)
    expect(undoFileEdit(forward, 'ad')?.text).toBe('abcd')
  })

  it('keeps structural edits separate and restores both selection directions', () => {
    const history = createFileHistory()
    const selected: FileSelection = { start: 2, end: 5, direction: 'backward' }
    recordFileEdit(history, snapshot('one two', selected), snapshot('one "two"', { start: 5, end: 8, direction: 'backward' }), 'command')
    recordFileEdit(history, snapshot('one "two"'), snapshot('one "two"\n'), 'command')

    expect(undoFileEdit(history, 'one "two"\n')?.text).toBe('one "two"')
    expect(undoFileEdit(history, 'one "two"')).toEqual(snapshot('one two', selected))
  })

  it('drops redo when typing takes a different branch', () => {
    const history = createFileHistory()
    recordFileEdit(history, snapshot(''), snapshot('a'), 'command')
    recordFileEdit(history, snapshot('a'), snapshot('ab'), 'command')
    expect(undoFileEdit(history, 'ab')?.text).toBe('a')
    recordFileEdit(history, snapshot('a'), snapshot('ax'), 'command')
    expect(redoFileEdit(history, 'ax')).toBeNull()
    expect(undoFileEdit(history, 'ax')?.text).toBe('a')
  })

  it('keeps an input method composition in one history step', () => {
    const history = createFileHistory()
    recordFileEdit(history, snapshot(''), snapshot('e'), 'composition', 0)
    recordFileEdit(history, snapshot('e'), snapshot('é'), 'composition', 100)
    expect(undoFileEdit(history, 'é')?.text).toBe('')
    expect(redoFileEdit(history, '')?.text).toBe('é')
  })
})
