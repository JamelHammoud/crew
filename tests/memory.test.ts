import { describe, expect, it } from 'vitest'
import {
  cleanMemoryLine,
  cleanMemoryLines,
  memoryKey,
  memoryPreamble,
  shortId,
  MEMORY_ADD_LIMIT,
  MEMORY_TEXT_LIMIT,
  type CrewMemory
} from '../src/shared/memory'

const one = (id: string, text: string): CrewMemory => ({ id, text, by: 'Fake', ts: 1 })

describe('what the crew has learned', () => {
  it('takes a sentence and refuses what is not one', () => {
    expect(cleanMemoryLine('  The tests   boot real servers \n')).toBe('The tests boot real servers')
    expect(cleanMemoryLine('   ')).toBe('')
    expect(cleanMemoryLine(12)).toBe('')
    expect(cleanMemoryLine(null)).toBe('')
  })

  it('holds a line to a sentence, since every one of them is in every prompt', () => {
    expect(cleanMemoryLine('x'.repeat(400))).toHaveLength(MEMORY_TEXT_LIMIT)
  })

  it('takes several at once, up to what one call may name', () => {
    const asked = Array.from({ length: MEMORY_ADD_LIMIT + 4 }, (_, at) => `Fact ${at}`)
    expect(cleanMemoryLines(asked)).toHaveLength(MEMORY_ADD_LIMIT)
    expect(cleanMemoryLines('One on its own')).toEqual(['One on its own'])
    expect(cleanMemoryLines(['', '  ', 'Real'])).toEqual(['Real'])
    expect(cleanMemoryLines([{ text: 'Written as an object' }])).toEqual(['Written as an object'])
    expect(cleanMemoryLines('   ')).toEqual([])
  })

  it('reads the same fact written twice as one', () => {
    expect(memoryKey('The tests boot   real servers')).toBe(memoryKey('the tests boot real servers'))
    expect(memoryKey('Something else')).not.toBe(memoryKey('The tests boot real servers'))
    expect(cleanMemoryLines(['Said twice', 'said   twice'])).toEqual(['Said twice'])
  })

  it('draws a short id and draws again on one already taken', () => {
    const id = shortId()
    expect(id).toMatch(/^[0-9a-f]{6}$/)
    const taken = new Set(Array.from({ length: 4096 }, (_, at) => at.toString(16).padStart(6, '0')))
    expect(taken.has(shortId(taken))).toBe(false)
  })

  it('writes the list out with its ids, and the calls under it', () => {
    const words = memoryPreamble('http://127.0.0.1:2739', 'run-1', [
      one('4f2a1c', 'The tests boot real servers, so run one suite at a time'),
      one('90bb31', 'The host runs the code it started with, so restart it after a change to the server')
    ])
    expect(words).toContain('4f2a1c  The tests boot real servers, so run one suite at a time')
    expect(words).toContain('90bb31  The host runs the code it started with')
    expect(words).toContain('http://127.0.0.1:2739/memory')
    expect(words).toContain('/memory/4f2a1c/forget')
    expect(words).toContain('"promptId":"run-1"')
    expect(words).toContain('?promptId=run-1')
    expect(words).not.toMatch(/—/)
  })

  it('still carries the calls with nothing written down yet', () => {
    const words = memoryPreamble('http://127.0.0.1:2739', 'run-1', [])
    expect(words).toContain('Nothing yet')
    expect(words).toContain('curl -s -X POST http://127.0.0.1:2739/memory')
  })
})
