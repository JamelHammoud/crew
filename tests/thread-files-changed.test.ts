import { describe, expect, it } from 'vitest'
import { stepsOfFamily, stepsOfThread, threadFamily } from '../src/renderer/src/components/thread'
import type { SessionEvent } from '../src/shared/events'
import type { AgentStep } from '../src/shared/llm'
import { boardOf } from '../src/shared/tickets'

const PARENT = 'parent-thread'
const HELPER = 'helper-thread'
const DEEPER = 'helper-of-helper'

const ran = (ts: number, threadId: string, promptId: string): SessionEvent => ({
  id: `start-${promptId}`,
  ts,
  kind: 'agent.start',
  promptId,
  agentId: 'a1',
  agentLabel: 'Bubbles',
  promptText: 'do it',
  byName: 'Bubbles',
  threadId
})

const edited = (ts: number, path: string, added: number, removed: number): AgentStep => ({
  id: `s-${ts}`,
  ts,
  kind: 'tool',
  status: 'done',
  name: 'Edit',
  files: [{ path, added, removed }]
})

const listed = (ts: number, text: string): AgentStep => ({
  id: `t-${ts}`,
  ts,
  kind: 'tool',
  status: 'done',
  name: 'TodoWrite',
  todos: [{ text, status: 'doing' }]
})

const threads = {
  [PARENT]: { id: PARENT },
  [HELPER]: { id: HELPER, parentThreadId: PARENT },
  [DEEPER]: { id: DEEPER, parentThreadId: HELPER }
}

const events = [ran(1, PARENT, 'p1'), ran(2, HELPER, 'p2'), ran(3, DEEPER, 'p3')]
const steps = {
  p1: [edited(4, 'src/own.ts', 3, 1)],
  p2: [edited(5, 'src/helper.ts', 10, 2)],
  p3: [edited(6, 'src/deeper.ts', 1, 0)]
}

const pathsOf = (gathered: AgentStep[]) => gathered.flatMap(step => step.files ?? []).map(file => file.path)

describe('what a thread says it changed', () => {
  it('counts what its helpers changed as its own', () => {
    expect(pathsOf(stepsOfFamily(PARENT, events, steps, threads))).toEqual([
      'src/own.ts',
      'src/helper.ts',
      'src/deeper.ts'
    ])
  })

  it('reaches a helper a helper sent out', () => {
    expect(pathsOf(stepsOfFamily(HELPER, events, steps, threads))).toEqual(['src/helper.ts', 'src/deeper.ts'])
  })

  it('says something for a run that split every edit off to helpers', () => {
    const sentOut = { p1: [], p2: steps.p2, p3: steps.p3 }
    expect(pathsOf(stepsOfThread(PARENT, events, sentOut))).toEqual([])
    expect(pathsOf(stepsOfFamily(PARENT, events, sentOut, threads))).toHaveLength(2)
  })

  it('leaves a thread with no helpers reading as its own', () => {
    expect(pathsOf(stepsOfFamily(PARENT, events, steps, { [PARENT]: { id: PARENT } }))).toEqual(['src/own.ts'])
  })

  it('settles rather than locking on a parent named in a circle', () => {
    const circle = { a: { id: 'a', parentThreadId: 'b' }, b: { id: 'b', parentThreadId: 'a' } }
    expect([...threadFamily('a', circle)].sort()).toEqual(['a', 'b'])
  })
})

describe('what a thread says it is working on', () => {
  it('keeps a helper off the board, so no list of work takes over another', () => {
    const lists = { p1: [listed(4, 'Draw the rows')], p2: [listed(5, "The helper's own step")] }
    const own = boardOf(stepsOfThread(PARENT, events, lists))
    expect(own.tickets.map(ticket => ticket.title)).toEqual(['Draw the rows'])

    const family = boardOf(stepsOfFamily(PARENT, events, lists, threads))
    expect(family.tickets.map(ticket => ticket.title)).toEqual(["The helper's own step"])
  })
})
