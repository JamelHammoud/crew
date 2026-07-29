import { describe, expect, it } from 'vitest'
import { makeCliProvider } from '../src/runner/providers/cli'
import { parseClaudeLine } from '../src/runner/providers/claude'
import { parseCodexLine } from '../src/runner/providers/codex'
import type { OutputParser, Provider } from '../src/runner/providers/types'
import type { RunStep, StepTodo } from '../src/shared/llm'
import { tmpDir } from './helpers/session'

const repo = tmpDir('step-todos')

// A CLI is a process that prints lines, so the test is one too: the lines go
// out as they really arrive and come back as the steps a thread would hold.
const echoing = (parser: OutputParser): Provider =>
  makeCliProvider({
    name: 'echo',
    label: 'Echo',
    command: process.execPath,
    args: prompt => ['-e', 'process.stdout.write(process.argv[1])', prompt],
    parser
  })

const claudeCli = echoing(parseClaudeLine)
const codexCli = echoing(parseCodexLine)

async function run(provider: Provider, lines: string[]): Promise<RunStep[]> {
  const steps: RunStep[] = []
  await provider.start(lines.join('\n') + '\n', repo, { onStep: step => steps.push(step) }).done
  return steps
}

const use = (id: string, name: string, input: unknown): string =>
  JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id, name, input }] } })

const result = (id: string, text: string): string =>
  JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content: text }] } })

const create = (id: string, subject: string): string =>
  use(id, 'TaskCreate', {
    subject,
    description: `${subject}, in full, at length`,
    activeForm: `${subject}ing`
  })

const listOn = (steps: RunStep[], id: string): StepTodo[] | undefined =>
  steps.filter(step => step.id === `t${id}` && step.todos).pop()?.todos

describe('a list folded from one call per task', () => {
  it('carries the whole list on every step that touches it', async () => {
    const steps = await run(claudeCli, [
      create('a1', 'Draw the rows'),
      result('a1', 'Task #1 created successfully: Draw the rows'),
      create('a2', 'Wire the panel'),
      result('a2', 'Task #2 created successfully: Wire the panel'),
      use('a3', 'TaskUpdate', { taskId: '2', status: 'in_progress' }),
      result('a3', 'Task #2 updated'),
      use('a4', 'TaskUpdate', { taskId: '1', status: 'completed' })
    ])

    // The first create is the whole list there is at that point.
    expect(listOn(steps, 'a1')).toEqual([{ text: 'Draw the rows', status: 'todo' }])
    // A ticket is named rather than narrated, so the subject wins over both the
    // description and the activeForm the same call carries.
    expect(listOn(steps, 'a4')).toEqual([
      { text: 'Draw the rows', status: 'done' },
      { text: 'Wire the panel', status: 'doing' }
    ])
  })

  it('reads the whole list back for a call that only asks for it', async () => {
    const steps = await run(claudeCli, [
      create('b1', 'Sketch it'),
      result('b1', 'Task #1 created successfully: Sketch it'),
      use('b2', 'TaskList', {}),
      use('b3', 'TaskGet', { taskId: '1' })
    ])
    expect(listOn(steps, 'b2')).toEqual([{ text: 'Sketch it', status: 'todo' }])
    expect(listOn(steps, 'b3')).toEqual([{ text: 'Sketch it', status: 'todo' }])
  })

  it('takes a deleted task off the list and leaves the rest in the order they were made', async () => {
    const steps = await run(claudeCli, [
      create('c1', 'Keep this'),
      result('c1', 'Task #1 created successfully: Keep this'),
      create('c2', 'Drop this'),
      result('c2', 'Task #2 created successfully: Drop this'),
      create('c3', 'Keep this too'),
      result('c3', 'Task #3 created successfully: Keep this too'),
      use('c4', 'TaskUpdate', { taskId: '2', status: 'deleted' })
    ])
    expect(listOn(steps, 'c4')).toEqual([
      { text: 'Keep this', status: 'todo' },
      { text: 'Keep this too', status: 'todo' }
    ])
  })

  it('lands a create whose result says nothing it can read, by the order it was made in', async () => {
    const steps = await run(claudeCli, [
      create('d1', 'First'),
      result('d1', 'ok'),
      create('d2', 'Second'),
      result('d2', 'ok'),
      use('d3', 'TaskUpdate', { taskId: '2', status: 'in_progress' })
    ])
    expect(listOn(steps, 'd3')).toEqual([
      { text: 'First', status: 'todo' },
      { text: 'Second', status: 'doing' }
    ])
  })

  it('takes a change that names a task made before the run as the task itself', async () => {
    const steps = await run(claudeCli, [
      use('e1', 'TaskUpdate', { taskId: '7', subject: 'Left over from yesterday', status: 'in_progress' })
    ])
    expect(listOn(steps, 'e1')).toEqual([{ text: 'Left over from yesterday', status: 'doing' }])
  })

  it('renames a task in place', async () => {
    const steps = await run(claudeCli, [
      create('f1', 'Rough name'),
      result('f1', 'Task #1 created successfully: Rough name'),
      use('f2', 'TaskUpdate', { taskId: '1', subject: 'The real name' })
    ])
    expect(listOn(steps, 'f2')).toEqual([{ text: 'The real name', status: 'todo' }])
  })

  it('belongs to the run, so a second run starts empty', async () => {
    const first = await run(claudeCli, [create('g1', 'Only mine'), result('g1', 'Task #1 created successfully')])
    expect(listOn(first, 'g1')).toEqual([{ text: 'Only mine', status: 'todo' }])

    const second = await run(claudeCli, [create('g2', 'Only ours'), result('g2', 'Task #1 created successfully')])
    expect(listOn(second, 'g2')).toEqual([{ text: 'Only ours', status: 'todo' }])
  })

  it('says nothing about a list for a tool that has nothing to do with one', async () => {
    const steps = await run(claudeCli, [use('h1', 'Bash', { command: 'ls -la' })])
    expect(steps.filter(step => step.id === 'th1').every(step => step.todos === undefined)).toBe(true)
  })
})

describe('a tool that hands over the whole list', () => {
  it('still reads every state Claude spells', async () => {
    const steps = await run(claudeCli, [
      use('w1', 'TodoWrite', {
        todos: [
          { content: 'Read the file', status: 'completed', activeForm: 'Reading the file' },
          { content: 'Draw the rows', status: 'in_progress', activeForm: 'Drawing the rows' },
          { content: 'Ship it', status: 'pending', activeForm: 'Shipping it' }
        ]
      })
    ])
    expect(listOn(steps, 'w1')).toEqual([
      { text: 'Read the file', status: 'done' },
      { text: 'Draw the rows', status: 'doing' },
      { text: 'Ship it', status: 'todo' }
    ])
  })

  it('still reads the boolean Codex says it with', async () => {
    const steps = await run(codexCli, [
      JSON.stringify({
        type: 'item.completed',
        item: {
          id: 'x1',
          type: 'todo_list',
          items: [
            { text: 'Read the file', completed: true },
            { text: 'Draw the rows', completed: false }
          ]
        }
      })
    ])
    expect(listOn(steps, 'x1')).toEqual([
      { text: 'Read the file', status: 'done' },
      { text: 'Draw the rows', status: 'todo' }
    ])
  })
})
