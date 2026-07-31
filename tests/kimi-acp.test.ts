import { describe, expect, it } from 'vitest'
import { kimiDialog, kimiParser } from '../src/runner/providers/kimi-acp'
import { makeCliProvider } from '../src/runner/providers/cli'
import { tmpDir } from './helpers/session'
import type { ParsedActivity, ParsedOutput } from '../src/runner/providers/types'

const reader = (settings: Record<string, string> = {}) => (key: string) => settings[key] ?? ''

const reply = (id: number, result: unknown) => JSON.stringify({ jsonrpc: '2.0', id, result })

const failed = (id: number, message: string, code = -32603) =>
  JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })

const request = (id: number, method: string, params: unknown) =>
  JSON.stringify({ jsonrpc: '2.0', id, method, params })

const note = (body: Record<string, unknown>) =>
  JSON.stringify({ jsonrpc: '2.0', method: 'session/update', params: { sessionId: 'session_abc', update: body } })

const chunk = (kind: string, text: string) => note({ sessionUpdate: kind, content: { type: 'text', text } })

const call = (body: Record<string, unknown>) => note({ sessionUpdate: 'tool_call', ...body })

const change = (body: Record<string, unknown>) => note({ sessionUpdate: 'tool_call_update', ...body })

const acted = (out: ParsedOutput[]): ParsedActivity => out.find(one => one.activity)!.activity!

const OPENED = {
  sessionId: 'session_abc',
  configOptions: [
    { id: 'mode', name: 'Mode', options: [{ id: 'yolo', name: 'Yolo' }] },
    { id: 'model', name: 'Model', options: [{ id: 'kimi-k2-thinking', name: 'K2 Thinking' }] }
  ]
}

const walk = (dialog: ReturnType<typeof kimiDialog>) => {
  const sent = [...dialog.begin()]
  sent.push(...dialog.answer(reply(1, { protocolVersion: 1, agentCapabilities: { loadSession: true } })))
  sent.push(...dialog.answer(reply(2, OPENED)))
  sent.push(...dialog.answer(reply(3, {})))
  sent.push(...dialog.answer(reply(4, {})))
  return sent.map(line => JSON.parse(line))
}

describe('the kimi handshake', () => {
  it('walks initialize, the session, what it is set to, and the turn', () => {
    const sent = walk(kimiDialog('add the two numbers', '/repo', reader({ model: 'kimi-k2-thinking' })))
    expect(sent.map(m => m.method)).toEqual([
      'initialize',
      'session/new',
      'session/set_config_option',
      'session/set_config_option',
      'session/prompt'
    ])
    expect(sent.map(m => m.id)).toEqual([1, 2, 3, 4, 5])
    expect(sent.every(m => m.jsonrpc === '2.0')).toBe(true)
    expect(sent[0].params).toEqual({
      protocolVersion: 1,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false }
    })
    expect(sent[1].params).toEqual({ cwd: '/repo', mcpServers: [] })
    expect(sent[2].params).toEqual({ sessionId: 'session_abc', configId: 'mode', value: 'yolo' })
    expect(sent[3].params).toEqual({ sessionId: 'session_abc', configId: 'model', value: 'kimi-k2-thinking' })
    expect(sent[4].params).toEqual({
      sessionId: 'session_abc',
      prompt: [{ type: 'text', text: 'add the two numbers' }]
    })
  })

  it('says nothing about a model nobody picked and goes straight to the turn', () => {
    const sent = walk(kimiDialog('go', '/repo', reader()))
    expect(sent.map(m => m.method)).toEqual([
      'initialize',
      'session/new',
      'session/set_config_option',
      'session/prompt'
    ])
    expect(sent.filter(m => m.method === 'session/set_config_option').map(m => m.params.configId)).toEqual(['mode'])
    expect(sent[3].params).toEqual({ sessionId: 'session_abc', prompt: [{ type: 'text', text: 'go' }] })
  })

  it('carries on to the turn when a setting is refused', () => {
    const dialog = kimiDialog('go', '/repo', reader({ model: 'gone-from-the-config' }))
    dialog.begin()
    dialog.answer(reply(1, { protocolVersion: 1 }))
    expect(JSON.parse(dialog.answer(reply(2, OPENED))[0]).params.configId).toBe('mode')

    const afterMode = dialog.answer(failed(3, 'unknown config option')).map(line => JSON.parse(line))
    expect(afterMode.map(m => m.method)).toEqual(['session/set_config_option'])
    expect(afterMode[0].params.configId).toBe('model')

    const afterModel = dialog.answer(failed(4, 'no such model')).map(line => JSON.parse(line))
    expect(afterModel.map(m => m.method)).toEqual(['session/prompt'])
    expect(afterModel[0].params).toEqual({ sessionId: 'session_abc', prompt: [{ type: 'text', text: 'go' }] })
  })

  it('waits on the reply to each step before it asks for the next', () => {
    const dialog = kimiDialog('go', '/repo', reader())
    expect(dialog.begin().map(line => JSON.parse(line).method)).toEqual(['initialize'])
    expect(dialog.answer(reply(9, { protocolVersion: 1 }))).toEqual([])
    expect(dialog.answer(reply(1, { protocolVersion: 1 })).map(line => JSON.parse(line).method)).toEqual([
      'session/new'
    ])
    expect(dialog.answer(reply(1, { protocolVersion: 1 }))).toEqual([])
  })

  it('asks for nothing more on a session that came back without an id', () => {
    const dialog = kimiDialog('go', '/repo', reader())
    dialog.begin()
    dialog.answer(reply(1, { protocolVersion: 1 }))
    expect(dialog.answer(reply(2, { configOptions: [] }))).toEqual([])
  })

  it('stops where it stands when a step before the session fails', () => {
    const dialog = kimiDialog('go', '/repo', reader())
    dialog.begin()
    expect(dialog.answer(failed(1, 'unsupported protocol version', -32602))).toEqual([])
  })

  it('never steers, before a turn or during one', () => {
    const dialog = kimiDialog('go', '/repo', reader())
    expect(dialog.steer('wait')).toBeNull()
    walk(dialog)
    expect(dialog.steer('actually stop')).toBeNull()
  })
})

describe('what kimi asks the client', () => {
  const OPTIONS = [
    { optionId: 'approve_once', name: 'Approve once', kind: 'allow_once' },
    { optionId: 'approve_always', name: 'Approve for this session', kind: 'allow_always' },
    { optionId: 'reject', name: 'Reject', kind: 'reject_once' }
  ]

  const permission = (dialog: ReturnType<typeof kimiDialog>, options: unknown) =>
    dialog.answer(
      request(7, 'session/request_permission', {
        sessionId: 'session_abc',
        options,
        toolCall: { toolCallId: '0:tool_Uhx', title: 'Bash', kind: 'execute' }
      })
    )

  it('says yes for the whole session when it is asked for permission', () => {
    const answered = permission(kimiDialog('go', '/repo', reader()), OPTIONS)
    expect(answered).toHaveLength(1)
    expect(JSON.parse(answered[0])).toEqual({
      jsonrpc: '2.0',
      id: 7,
      result: { outcome: { outcome: 'selected', optionId: 'approve_always' } }
    })
  })

  it('falls down the options, and cancels when there is no way to say yes', () => {
    const dialog = kimiDialog('go', '/repo', reader())
    const outcome = (options: unknown) => JSON.parse(permission(dialog, options)[0]).result.outcome
    expect(outcome([OPTIONS[0], OPTIONS[2]])).toEqual({ outcome: 'selected', optionId: 'approve_once' })
    expect(outcome([{ optionId: 'go_on', name: 'Go on', kind: 'allow_other' }])).toEqual({
      outcome: 'selected',
      optionId: 'go_on'
    })
    expect(outcome([OPTIONS[2], { optionId: 'reject_always', name: 'Never', kind: 'reject_always' }])).toEqual({
      outcome: 'cancelled'
    })
    expect(outcome([])).toEqual({ outcome: 'cancelled' })
  })

  it('refuses a request it has no answer for rather than leaving the run hanging', () => {
    const refused = kimiDialog('go', '/repo', reader()).answer(request(8, 'fs/read_text_file', { path: 'math.js' }))
    expect(refused).toHaveLength(1)
    const body = JSON.parse(refused[0])
    expect(body).toMatchObject({ jsonrpc: '2.0', id: 8, error: { code: -32601 } })
    expect(body.error.message).toContain('fs/read_text_file')
  })

  it('answers nothing to a notification, which has no id to answer', () => {
    const dialog = kimiDialog('go', '/repo', reader())
    expect(dialog.answer(chunk('agent_message_chunk', 'I will read it'))).toEqual([])
    expect(dialog.answer(JSON.stringify({ jsonrpc: '2.0', method: 'session/update', params: {} }))).toEqual([])
  })
})

describe('what kimi says while it works', () => {
  it('streams a thought and an answer, each on a lane of its own', () => {
    const parse = kimiParser().parse
    expect(parse(chunk('agent_thought_chunk', 'The'))).toEqual([
      { thinkingStart: { index: 1 } },
      { thinkingDelta: { index: 1, text: 'The' } }
    ])
    expect(parse(chunk('agent_thought_chunk', ' file adds'))).toEqual([
      { thinkingDelta: { index: 1, text: ' file adds' } }
    ])
    expect(parse(chunk('agent_message_chunk', 'I will'))).toEqual([
      { blockStop: { index: 1 } },
      { textStart: { index: 2 } },
      { textDelta: { index: 2, text: 'I will' } }
    ])
    expect(parse(chunk('agent_message_chunk', ' read it'))).toEqual([{ textDelta: { index: 2, text: ' read it' } }])
  })

  it('never stands a block on an index another block has held', () => {
    const parse = kimiParser().parse
    const out: ParsedOutput[] = []
    out.push(...parse(chunk('agent_thought_chunk', 'one')))
    out.push(...parse(chunk('agent_message_chunk', 'two')))
    out.push(...parse(chunk('agent_thought_chunk', 'three')))
    out.push(...parse(call({ toolCallId: '0:tool_Uhx', title: 'Read', kind: 'read', status: 'pending' })))
    out.push(...parse(chunk('agent_message_chunk', 'four')))

    const opened = out.flatMap(one => {
      const start = one.thinkingStart ?? one.textStart
      return start ? [start.index] : []
    })
    expect(opened).toEqual([1, 2, 3, 4])
    expect(new Set(opened).size).toBe(opened.length)
    expect(out.filter(one => one.blockStop).map(one => one.blockStop!.index)).toEqual([1, 2, 3])
  })

  it('opens nothing for a chunk with no words in it', () => {
    const parse = kimiParser().parse
    expect(parse(chunk('agent_message_chunk', ''))).toEqual([])
    expect(parse(note({ sessionUpdate: 'agent_thought_chunk', content: { type: 'image', data: 'x' } }))).toEqual([])
  })
})

describe('what kimi says it did', () => {
  it('keeps the name the tool started under when the title turns into a phrase', () => {
    const parse = kimiParser().parse
    const started = parse(
      call({ toolCallId: '0:tool_Uhx', title: 'Read', kind: 'read', status: 'pending', content: [] })
    )
    expect(acted(started)).toEqual({ id: '0:tool_Uhx', kind: 'tool', name: 'Read', status: 'started' })

    const narrated = parse(
      change({
        toolCallId: '0:tool_Uhx',
        title: 'Reading math.js',
        kind: 'read',
        status: 'in_progress',
        rawInput: { path: 'math.js' },
        content: []
      })
    )
    expect(acted(narrated)).toMatchObject({ name: 'Read', status: 'started', detail: 'math.js' })

    const done = parse(
      change({ toolCallId: '0:tool_Uhx', status: 'completed', rawOutput: '1\texport function add(a, b) {' })
    )
    expect(acted(done)).toMatchObject({ name: 'Read', status: 'finished' })
  })

  it('counts an edit the way the file changed and carries the diff with it', () => {
    const parse = kimiParser().parse
    parse(call({ toolCallId: '0:tool_Edt', title: 'Edit', kind: 'edit', status: 'pending' }))
    const out = parse(
      change({
        toolCallId: '0:tool_Edt',
        title: 'Editing math.js',
        status: 'in_progress',
        rawInput: { path: 'math.js', old_string: '  return a - b', new_string: '  return a + b' }
      })
    )
    expect(acted(out)).toMatchObject({ name: 'Edit', detail: 'math.js', status: 'started' })
    expect(acted(out).files).toEqual([
      { path: 'math.js', added: 1, removed: 1, diff: '-   return a - b\n+   return a + b' }
    ])
  })

  it('names a helper as a helper', () => {
    const parse = kimiParser().parse
    const out = parse(call({ toolCallId: '0:tool_Agt', title: 'Agent', kind: 'other', status: 'pending' }))
    expect(acted(out).kind).toBe('subagent')
  })

  it('says nothing about an update with no tool on it', () => {
    expect(kimiParser().parse(change({ status: 'completed', rawOutput: 'done' }))).toEqual([])
  })

  it('hands every finished tool its result, and the run keeps only what a command printed', async () => {
    const parse = kimiParser().parse
    parse(call({ toolCallId: '0:tool_Rd', title: 'Read', kind: 'read', status: 'pending' }))
    const read = parse(change({ toolCallId: '0:tool_Rd', status: 'completed', rawOutput: 'export function add' }))
    expect(acted(read).output).toBe('export function add')

    const lines = [
      call({ toolCallId: '0:tool_Bsh', title: 'Bash', kind: 'execute', status: 'pending' }),
      change({
        toolCallId: '0:tool_Bsh',
        title: 'Running echo done',
        status: 'completed',
        rawInput: { command: 'echo done' },
        rawOutput: 'done'
      }),
      call({ toolCallId: '0:tool_Rd', title: 'Read', kind: 'read', status: 'pending' }),
      change({ toolCallId: '0:tool_Rd', status: 'completed', rawOutput: '1\texport function add(a, b) {' })
    ]
    const provider = makeCliProvider({
      name: 'kimifake',
      label: 'Kimi',
      command: process.execPath,
      args: () => ['-e', `for (const l of ${JSON.stringify(lines)}) process.stdout.write(l + '\\n')`],
      makeParser: kimiParser
    })
    const outputs = new Map<string, string | undefined>()
    const run = provider.start('go', tmpDir('kimi-acp'), {
      onStep: step => {
        if (step.kind === 'tool' && step.status === 'done') outputs.set(step.id, step.output)
      }
    })
    await run.done
    expect(outputs.get('t0:tool_Bsh')).toBe('done')
    expect(outputs.get('t0:tool_Rd')).toBeUndefined()
  })

  it('reads a result given as content blocks when there is no raw output', () => {
    const parse = kimiParser().parse
    parse(call({ toolCallId: '0:tool_Bsh', title: 'Bash', kind: 'execute', status: 'pending' }))
    const out = parse(
      change({
        toolCallId: '0:tool_Bsh',
        status: 'completed',
        content: [{ type: 'content', content: { type: 'text', text: 'done' } }]
      })
    )
    expect(acted(out).output).toBe('done')
  })
})

describe('the end of a turn', () => {
  const stopped = (stopReason: string) => kimiParser().parse(reply(3, { stopReason }))

  it('ends the turn on end_turn and says nothing about it', () => {
    expect(stopped('end_turn')).toEqual([{ turnEnd: true }])
  })

  it('says in a sentence why the model stopped short', () => {
    expect(stopped('refusal')).toEqual([{ error: 'Kimi declined to answer this one.' }, { turnEnd: true }])
    expect(stopped('max_tokens')).toEqual([
      { error: 'Kimi reached its token limit before it finished.' },
      { turnEnd: true }
    ])
    expect(stopped('max_turn_requests')).toEqual([
      { error: 'Kimi reached its limit of steps before it finished.' },
      { turnEnd: true }
    ])
  })

  it('closes the block that was still open as the turn ends', () => {
    const parse = kimiParser().parse
    parse(chunk('agent_message_chunk', 'Added the line.'))
    expect(parse(reply(3, { stopReason: 'end_turn' }))).toEqual([{ blockStop: { index: 1 } }, { turnEnd: true }])
  })

  it('ends nothing on a reply that carries no stop reason', () => {
    expect(kimiParser().parse(reply(1, { protocolVersion: 1, agentCapabilities: {} }))).toEqual([])
    expect(kimiParser().parse(reply(2, { sessionId: 'session_abc', configOptions: [] }))).toEqual([])
  })
})

describe('a parser a run', () => {
  it('keeps two runs out of the lanes and the tool names either one is holding', () => {
    const one = kimiParser().parse
    const two = kimiParser().parse

    expect(one(chunk('agent_thought_chunk', 'mine'))[0]).toEqual({ thinkingStart: { index: 1 } })
    expect(two(chunk('agent_message_chunk', 'mine too'))[0]).toEqual({ textStart: { index: 1 } })

    one(call({ toolCallId: '0:tool_Uhx', title: 'Bash', kind: 'execute', status: 'pending' }))
    const stranger = two(change({ toolCallId: '0:tool_Uhx', status: 'completed', rawOutput: 'done' }))
    expect(acted(stranger).name).toBe('')

    const own = one(change({ toolCallId: '0:tool_Uhx', status: 'completed', rawOutput: 'done' }))
    expect(acted(own).name).toBe('Bash')
  })
})

describe('a line it cannot use', () => {
  it('reads past junk without throwing, in the parser and in the dialog', () => {
    const parse = kimiParser().parse
    expect(parse('not json')).toEqual([])
    expect(parse('')).toEqual([])
    expect(parse('{"jsonrpc":"2.0",')).toEqual([])
    expect(parse(note({ sessionUpdate: 'available_commands_update' }))).toEqual([])

    const dialog = kimiDialog('go', '/repo', reader())
    expect(dialog.answer('not json')).toEqual([])
    expect(dialog.answer('')).toEqual([])
  })

  it('carries a failure through as the sentence it came with', () => {
    expect(kimiParser().parse(failed(3, 'The model is not available on this account.'))).toEqual([
      { error: 'The model is not available on this account.' },
      { turnEnd: true }
    ])
    const parse = kimiParser().parse
    parse(reply(2, { sessionId: 'session_x' }))
    parse(chunk('agent_message_chunk', 'Half a se'))
    expect(parse(failed(3, 'The stream dropped.'))).toEqual([
      { blockStop: { index: 1 } },
      { error: 'The stream dropped.' }
    ])
  })
})
