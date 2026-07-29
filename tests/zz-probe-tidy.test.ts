import { describe, expect, it } from 'vitest'
import { tidy, TIDY_RULES } from '../src/shared/scribeTidy'

const at = (words: string, start: number, end: number) => ({ text: words, start, end })

describe('probe', () => {
  it('correction across a sentence boundary', () => {
    console.log(JSON.stringify(tidy([
      at("Let's use redis.", 0, 1.5),
      at('Scratch that.', 2.4, 3.0),
      at("Let's use postgres.", 3.4, 4.6)
    ], TIDY_RULES)))
  })
  it('correction inside one sentence', () => {
    console.log(JSON.stringify(tidy([
      at("let's use redis,", 0, 1.5),
      at('scratch that,', 1.6, 2.0),
      at("let's use postgres", 2.1, 3.2)
    ], TIDY_RULES)))
  })
  it('actually wait', () => {
    console.log(JSON.stringify(tidy([
      at('I think we should ship it today.', 0, 2.0),
      at('Actually, wait.', 2.6, 3.2),
      at('I think we should ship it tomorrow.', 3.6, 5.6)
    ], TIDY_RULES)))
  })
})
