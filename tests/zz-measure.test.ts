import { test } from 'vitest'
import { boardsPreamble } from '../src/shared/design'
import { memoryPreamble } from '../src/shared/memory'
import { pagePreamble } from '../src/shared/showPage'
import { subagentPreamble } from '../src/shared/subagents'
import { ticketPreamble } from '../src/shared/tickets'
import { VOICE_INSTRUCTIONS } from '../src/shared/voice'
import { SUBAGENT_INSTRUCTIONS } from '../src/shared/subagents'
import { POST_INSTRUCTIONS } from '../src/shared/post'
import { PLAN_INSTRUCTIONS } from '../src/shared/plan'
import { ASIDE_INSTRUCTIONS } from '../src/shared/aside'

const base = 'http://127.0.0.1:2739/6329c2'
const promptId = '1f3603ae-a7f1-44f0-b475-2a767101e615'

const memories = Array.from({ length: 12 }, (_, i) => ({
  id: `abc${i}0`,
  text: 'The tests boot real servers on loopback, so run one suite at a time rather than the whole file list.',
  by: 'Bubbles',
  byId: 'a1',
  at: 0
}))

test('measure', () => {
  const rows: Array<[string, string | null]> = [
    ['memoryPreamble (12 memories)', memoryPreamble(base, promptId, memories)],
    ['memoryPreamble (0 memories)', memoryPreamble(base, promptId, [])],
    ['subagentPreamble (room 6, 4 providers)', subagentPreamble(base, promptId, 6, ['claude', 'codex', 'kimi', 'local'])],
    ['pagePreamble', pagePreamble(base, promptId)],
    ['ticketPreamble', ticketPreamble(base, promptId)],
    ['boardsPreamble (no board)', boardsPreamble(base, 'a1', undefined, [])],
    ['VOICE_INSTRUCTIONS', VOICE_INSTRUCTIONS],
    ['SUBAGENT_INSTRUCTIONS', SUBAGENT_INSTRUCTIONS],
    ['POST_INSTRUCTIONS', POST_INSTRUCTIONS],
    ['PLAN_INSTRUCTIONS', PLAN_INSTRUCTIONS],
    ['ASIDE_INSTRUCTIONS', ASIDE_INSTRUCTIONS]
  ]
  for (const [name, text] of rows) {
    console.log(`${String(text?.length ?? 0).padStart(6)}  ${name}`)
  }
  const runner =
    (memoryPreamble(base, promptId, memories) ?? '') +
    (subagentPreamble(base, promptId, 6, ['claude', 'codex', 'kimi', 'local']) ?? '') +
    pagePreamble(base, promptId)
  console.log(`${String(runner.length).padStart(6)}  runner preambles a voice turn carries today`)
  console.log(
    `${String(runner.length + ticketPreamble(base, promptId).length).padStart(6)}  with the board as well`
  )
})
