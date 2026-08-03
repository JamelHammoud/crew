import { describe, expect, it } from 'vitest'
import { codexDialog } from '../src/runner/providers/codex-app'
import { commandTool, codexFile } from '../src/runner/providers/codex-items'
import { parseCodexLine } from '../src/runner/providers/codex'
import { makeCliProvider } from '../src/runner/providers/cli'
import type { ParsedOutput } from '../src/runner/providers/types'

const reader = (settings: Record<string, string> = {}) => (key: string) => settings[key] ?? ''

const note = (method: string, params: unknown) => JSON.stringify({ jsonrpc: '2.0', method, params })
const reply = (id: number, result: unknown) => JSON.stringify({ jsonrpc: '2.0', id, result })

const parsed = (method: string, params: unknown): ParsedOutput[] => parseCodexLine(note(method, params))

const walk = (dialog: ReturnType<typeof codexDialog>) => {
  const sent = [...dialog.begin()]
  sent.push(...dialog.answer(reply(1, { userAgent: 'crew' })))
  sent.push(...dialog.answer(reply(2, { thread: { id: 'thread-1' } })))
  sent.push(...dialog.answer(reply(3, { turn: { id: 'turn-1', status: 'inProgress' } })))
  return sent.map(line => JSON.parse(line))
}

describe('the codex handshake', () => {
  it('walks initialize, thread and turn in order', () => {
    const sent = walk(codexDialog('do the thing', '/repo', reader()))
    expect(sent.map(m => m.method)).toEqual(['initialize', 'initialized', 'thread/start', 'turn/start'])
    expect(sent[0].params.clientInfo.name).toBe('crew')
    expect(sent[2].params.cwd).toBe('/repo')
    expect(sent[3].params.input).toEqual([{ type: 'text', text: 'do the thing' }])
    expect(sent[3].params.summary).toBe('detailed')
    expect(sent[3].params.sandboxPolicy).toEqual({ type: 'dangerFullAccess' })
  })

  it('sets a goal before starting its turn', () => {
    const dialog = codexDialog(
      'You are an agent here.\n\nfinish the migration\n\ncurl -s -X POST http://127.0.0.1:1/agents/spawn',
      '/repo',
      reader(),
      { goal: 'finish the migration' }
    )
    const sent = [...dialog.begin()]
    sent.push(...dialog.answer(reply(1, { userAgent: 'crew' })))
    sent.push(...dialog.answer(reply(2, { thread: { id: 'thread-1' } })))
    sent.push(...dialog.answer(reply(3, { goal: { objective: 'finish the migration', status: 'active' } })))
    const messages = sent.map(line => JSON.parse(line))

    expect(messages.map(message => message.method)).toEqual([
      'initialize',
      'initialized',
      'thread/start',
      'thread/goal/set',
      'turn/start'
    ])
    expect(messages[3].params).toEqual({
      threadId: 'thread-1',
      objective: 'finish the migration',
      status: 'active'
    })
    expect(messages[4].params.input).toEqual([{ type: 'text', text: 'finish the migration' }])
  })

  it('steers the live turn and holds the message back once the turn is over', () => {
    const dialog = codexDialog('go', '/repo', reader())
    expect(dialog.steer('wait')).toBeNull()
    walk(dialog)
    const steer = JSON.parse(dialog.steer('actually stop') as string)
    expect(steer.method).toBe('turn/steer')
    expect(steer.params).toMatchObject({ threadId: 'thread-1', expectedTurnId: 'turn-1' })
    expect(steer.params.input).toEqual([{ type: 'text', text: 'actually stop' }])

    dialog.answer(note('turn/completed', { turn: { id: 'turn-1', status: 'completed' } }))
    expect(dialog.steer('too late')).toBeNull()
  })

  it('takes the turn id from the notification when the response has not landed', () => {
    const dialog = codexDialog('go', '/repo', reader())
    dialog.begin()
    dialog.answer(reply(1, {}))
    dialog.answer(reply(2, { thread: { id: 'thread-1' } }))
    dialog.answer(note('turn/started', { turn: { id: 'turn-9' } }))
    expect(JSON.parse(dialog.steer('now') as string).params.expectedTurnId).toBe('turn-9')
  })

  it('accepts an approval and refuses a request it cannot answer', () => {
    const dialog = codexDialog('go', '/repo', reader())
    const approval = dialog.answer(
      JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'item/commandExecution/requestApproval', params: {} })
    )
    expect(JSON.parse(approval[0])).toMatchObject({ id: 7, result: { decision: 'accept' } })
    const other = dialog.answer(
      JSON.stringify({ jsonrpc: '2.0', id: 8, method: 'account/chatgptAuthTokens/refresh', params: {} })
    )
    expect(JSON.parse(other[0]).error.code).toBe(-32601)
  })
})

describe('what codex says while it works', () => {
  it('streams reasoning as it lands, one block a stretch', () => {
    expect(parsed('item/reasoning/summaryPartAdded', { summaryIndex: 0 })).toEqual([
      { blockStop: { index: 1 } },
      { thinkingStart: { index: 1 } }
    ])
    expect(parsed('item/reasoning/summaryTextDelta', { summaryIndex: 0, delta: '**Planning**' })).toEqual([
      { thinkingDelta: { index: 1, text: '**Planning**' } }
    ])
    expect(parsed('item/reasoning/summaryTextDelta', { summaryIndex: 1, delta: '**Checking**' })).toEqual([
      { thinkingDelta: { index: 3, text: '**Checking**' } }
    ])
  })

  it('draws raw reasoning where a model sends it, clear of the summaries', () => {
    expect(parsed('item/reasoning/textDelta', { contentIndex: 0, delta: 'So the file ends ' })).toEqual([
      { thinkingDelta: { index: 2, text: 'So the file ends ' } }
    ])
    expect(parsed('item/reasoning/textDelta', { contentIndex: 1, delta: 'and the pattern is' })).toEqual([
      { thinkingDelta: { index: 4, text: 'and the pattern is' } }
    ])
    const summaries = [0, 1, 2].map(i => parsed('item/reasoning/summaryTextDelta', { summaryIndex: i, delta: 'x' }))
    const raw = [0, 1, 2].map(i => parsed('item/reasoning/textDelta', { contentIndex: i, delta: 'x' }))
    const index = (out: ParsedOutput[]) => out[0].thinkingDelta!.index
    expect(summaries.map(index).some(i => raw.map(index).includes(i))).toBe(false)
  })

  it('closes every stretch a reasoning item held, on both channels', () => {
    const out = parsed('item/completed', {
      item: { type: 'reasoning', id: 'rs_1', summary: ['**One**', '**Two**'], content: [] }
    })
    expect(out.filter(o => o.blockStop).map(o => o.blockStop!.index)).toEqual([1, 3])
    expect(out.find(o => o.thinking)?.thinking).toBe('**One**\n\n**Two**')

    const both = parsed('item/completed', {
      item: { type: 'reasoning', id: 'rs_2', summary: ['**One**'], content: ['The file ends in a newline.'] }
    })
    expect(both.filter(o => o.blockStop).map(o => o.blockStop!.index)).toEqual([1, 2])
    expect(both.find(o => o.thinking)?.thinking).toBe('**One**\n\nThe file ends in a newline.')
  })

  it('streams the answer token by token and never on an index reasoning holds', () => {
    expect(parsed('item/started', { item: { type: 'agentMessage', id: 'm1', text: '', phase: 'final_answer' } })).toEqual(
      [{ textStart: { index: 0, aside: false } }]
    )
    expect(parsed('item/agentMessage/delta', { delta: 'Do' })).toEqual([{ textDelta: { index: 0, text: 'Do' } }])
    const done = parsed('item/completed', { item: { type: 'agentMessage', id: 'm1', text: 'Done.', phase: 'final_answer' } })
    expect(done).toEqual([{ blockStop: { index: 0 } }, { text: 'Done.' }])
  })

  it('shows what it says on the way as it goes, and keeps it out of the answer', () => {
    const item = { type: 'agentMessage', id: 'm0', text: 'I will read the file first.', phase: 'commentary' }
    expect(parsed('item/started', { item: { ...item, text: '' } })).toEqual([
      { textStart: { index: 0, aside: true } }
    ])
    expect(parsed('item/completed', { item })).toEqual([{ blockStop: { index: 0 } }])
  })

  it('says nothing at all about the message the person sent', () => {
    expect(parsed('item/started', { item: { type: 'userMessage', id: 'u1', content: [] } })).toEqual([])
  })

  it('counts the whole thread rather than adding each call to the last', () => {
    const out = parsed('thread/tokenUsage/updated', {
      tokenUsage: { total: { inputTokens: 40080, cachedInputTokens: 19200, outputTokens: 218, totalTokens: 40298 } }
    })
    expect(out[0].usage).toMatchObject({ input: 20880, cacheRead: 19200, output: 218, total: true })
  })

  it('reads the model off the thread it opened', () => {
    expect(parseCodexLine(reply(2, { model: 'gpt-5.6-sol', thread: { id: 't' } }))).toEqual([
      { usage: { model: 'gpt-5.6-sol' } }
    ])
  })

  it('ends the turn, and says why only when it failed', () => {
    expect(parsed('turn/completed', { turn: { status: 'completed' } })).toEqual([{ turnEnd: true }])
    const failed = parsed('turn/completed', { turn: { status: 'failed', error: { message: 'Ran out of context.' } } })
    expect(failed).toEqual([{ turnEnd: true }, { error: 'Ran out of context.' }])
  })

  it('holds its tongue about a failure it is about to retry', () => {
    expect(parsed('error', { willRetry: true, error: { message: 'stream dropped' } })).toEqual([])
    expect(parsed('error', { willRetry: false, error: { message: 'stream dropped' } })).toEqual([
      { error: 'stream dropped' }
    ])
  })

  it('folds the plan into one list rather than a row a change', () => {
    const out = parsed('turn/plan/updated', {
      plan: [
        { step: 'Read the schema', status: 'completed' },
        { step: 'Write the parser', status: 'inProgress' },
        { step: 'Run the suite', status: 'pending' }
      ]
    })
    expect(out[0].activity?.name).toBe('UpdatePlan')
    expect(out[0].activity?.todos).toEqual([
      { text: 'Read the schema', status: 'done' },
      { text: 'Write the parser', status: 'doing' },
      { text: 'Run the suite', status: 'todo' }
    ])
    expect(out[0].activity?.detail).toBe('Write the parser')
  })
})

describe('what codex says it did', () => {
  it('names a command by what codex already parsed it into', () => {
    expect(commandTool({ command: "/bin/zsh -lc 'cat notes.txt'", commandActions: [{ type: 'read', name: 'notes.txt', path: '/repo/notes.txt', command: 'cat notes.txt' }] })).toEqual({ name: 'Read', detail: '/repo/notes.txt' })
    expect(commandTool({ commandActions: [{ type: 'listFiles', command: 'ls -la', path: null }] })).toEqual({
      name: 'ListFiles',
      detail: 'ls -la'
    })
    expect(commandTool({ commandActions: [{ type: 'search', query: 'zzz', path: 'src', command: 'grep -rn zzz src' }] })).toEqual({ name: 'Search', detail: 'zzz in src' })
  })

  it('falls back to the command with the shell wrapper taken off', () => {
    expect(commandTool({ command: "/bin/zsh -lc 'yarn test'", commandActions: [] })).toEqual({
      name: 'Shell',
      detail: 'yarn test'
    })
    expect(commandTool({ command: "/bin/zsh -lc 'echo a && sleep 1'", commandActions: [{ type: 'unknown', command: 'echo a && sleep 1' }] })).toEqual({ name: 'Shell', detail: 'echo a && sleep 1' })
  })

  it('reads several piped actions as one command', () => {
    expect(
      commandTool({
        command: 'x',
        commandActions: [
          { type: 'read', command: 'cat a' },
          { type: 'search', command: 'grep b' }
        ]
      })
    ).toEqual({ name: 'Shell', detail: 'cat a && grep b' })
  })

  it('counts a hunk the way the file changed', () => {
    expect(codexFile({ path: '/repo/notes.txt', kind: { type: 'update' }, diff: '@@ -2 +2,2 @@\n two\n+hello\n' })).toEqual({
      path: '/repo/notes.txt',
      added: 1,
      removed: 0,
      diff: '@@ -2 +2,2 @@\n two\n+hello\n'
    })
  })

  it('marks up a new file, which arrives as its own body', () => {
    expect(codexFile({ path: '/repo/new.txt', kind: { type: 'add' }, diff: 'First\nSecond\n' })).toEqual({
      path: '/repo/new.txt',
      added: 2,
      removed: 0,
      diff: '+First\n+Second'
    })
  })

  it('marks up a deleted file the same way, the other way round', () => {
    expect(codexFile({ path: '/repo/gone.txt', kind: { type: 'delete' }, diff: 'One\n' })).toEqual({
      path: '/repo/gone.txt',
      added: 0,
      removed: 1,
      diff: '-One'
    })
  })

  it('carries the diff on the step the moment the change starts', () => {
    const out = parsed('item/started', {
      item: {
        type: 'fileChange',
        id: 'call_1',
        status: 'inProgress',
        changes: [{ path: '/repo/notes.txt', kind: { type: 'update' }, diff: '@@ -1 +1,2 @@\n one\n+two\n' }]
      }
    })
    expect(out[0].activity).toMatchObject({ id: 'call_1', name: 'Edit', status: 'started', detail: '/repo/notes.txt' })
    expect(out[0].activity?.files).toEqual([
      { path: '/repo/notes.txt', added: 1, removed: 0, diff: '@@ -1 +1,2 @@\n one\n+two\n' }
    ])
  })

  it('names a web search by the queries it really ran', () => {
    const out = parsed('item/completed', {
      item: { type: 'webSearch', id: 'w1', query: 'truncated …', action: { type: 'search', queries: ['rust 2026', 'cargo'] } }
    })
    expect(out[0].activity).toMatchObject({ name: 'WebSearch', detail: 'rust 2026, cargo' })
  })

  it('names an mcp call after the tool rather than the plumbing', () => {
    const out = parsed('item/completed', {
      item: { type: 'mcpToolCall', id: 'x1', server: 'figma', tool: 'get_metadata', arguments: { nodeId: '1:2' } }
    })
    expect(out[0].activity?.name).toBe('figma.get_metadata')
  })

  it('reads a helper as a helper', () => {
    const out = parsed('item/started', {
      item: { type: 'subAgentActivity', id: 's1', agentPath: 'reviewer', agentThreadId: 't2', kind: 'started' }
    })
    expect(out[0].activity).toMatchObject({ kind: 'subagent', name: 'Agent', detail: 'reviewer' })
  })

  it('keeps what a command printed and nothing else', () => {
    const command = parsed('item/completed', {
      item: {
        type: 'commandExecution',
        id: 'c1',
        command: "/bin/zsh -lc 'yarn test'",
        commandActions: [{ type: 'unknown', command: 'yarn test' }],
        status: 'completed',
        aggregatedOutput: 'ok\n'
      }
    })
    expect(command[0].activity?.output).toBe('ok')
  })

  it('ignores everything the protocol says that is not the work', () => {
    expect(parsed('mcpServer/startupStatus/updated', { name: 'node_repl', status: 'ready' })).toEqual([])
    expect(parsed('account/rateLimits/updated', { rateLimits: {} })).toEqual([])
    expect(parsed('thread/status/changed', { status: { type: 'idle' } })).toEqual([])
    expect(parseCodexLine('not json')).toEqual([])
  })
})

describe('what the commentary reads as', () => {
  const speak = (lines: string[]) =>
    makeCliProvider({
      name: 'codexfake',
      label: 'Codex',
      command: process.execPath,
      args: () => ['-e', `for (const l of ${JSON.stringify(lines)}) process.stdout.write(l + '\\n')`],
      parser: parseCodexLine
    })

  const run = async (lines: string[]) => {
    const steps: Array<{ kind?: string; text?: string }> = []
    const started = speak(lines).start('go', process.cwd(), {
      onStep: step => {
        if (step.text) steps.push({ kind: step.kind, text: step.text })
      }
    })
    return { steps, ...(await started.done) }
  }

  const commentary = [
    note('item/started', { item: { type: 'agentMessage', id: 'c0', phase: 'commentary' } }),
    note('item/agentMessage/delta', { itemId: 'c0', delta: 'Reading the file and working out the pattern.' }),
    note('item/completed', {
      item: { type: 'agentMessage', id: 'c0', phase: 'commentary', text: 'Reading the file and working out the pattern.' }
    })
  ]

  const answer = [
    note('item/started', { item: { type: 'agentMessage', id: 'a0', phase: 'final_answer' } }),
    note('item/agentMessage/delta', { itemId: 'a0', delta: 'Appended the line.' }),
    note('item/completed', { item: { type: 'agentMessage', id: 'a0', phase: 'final_answer', text: 'Appended the line.' } })
  ]

  it('draws what codex says on the way as a thought, and the answer as the answer', async () => {
    const { steps, text } = await run([...commentary, ...answer])
    expect(steps).toEqual([
      { kind: 'thinking', text: 'Reading the file and working out the pattern.' },
      { kind: 'text', text: 'Appended the line.' }
    ])
    expect(text).toBe('Appended the line.')
  })

  it('still answers with the commentary when a turn ends without one', async () => {
    const { steps, text } = await run(commentary)
    expect(steps.map(s => s.kind)).toEqual(['thinking'])
    expect(text).toBe('Reading the file and working out the pattern.')
  })

  it('keeps a stretch of reasoning on its own rail beside it', async () => {
    const { steps } = await run([
      ...commentary,
      note('item/reasoning/summaryPartAdded', { summaryIndex: 0 }),
      note('item/reasoning/summaryTextDelta', { summaryIndex: 0, delta: '**Planning the edit**' }),
      ...answer
    ])
    expect(steps).toEqual([
      { kind: 'thinking', text: 'Reading the file and working out the pattern.' },
      { kind: 'thinking', text: '**Planning the edit**' },
      { kind: 'text', text: 'Appended the line.' }
    ])
  })
})
