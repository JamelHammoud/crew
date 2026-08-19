import { realpathSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { kimiDialog, kimiParser } from '../src/runner/providers/kimi-acp'
import { makeCliProvider } from '../src/runner/providers/cli'
import { tmpDir } from './helpers/session'
import type { ParsedActivity, ParsedOutput } from '../src/runner/providers/types'

const reader =
  (settings: Record<string, string> = {}) =>
  (key: string) =>
    settings[key] ?? ''

const reply = (id: number, result: unknown) => JSON.stringify({ jsonrpc: '2.0', id, result })

const failed = (id: number, message: string, code = -32603) =>
  JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })

const request = (id: number, method: string, params: unknown) => JSON.stringify({ jsonrpc: '2.0', id, method, params })

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

const LATE_CANCEL = `
const send = o => process.stdout.write(JSON.stringify(o) + '\\n')
const chunk = text =>
  send({ jsonrpc: '2.0', method: 'session/update', params: { update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } } } })
let asked = null
let turns = 0
require('readline')
  .createInterface({ input: process.stdin })
  .on('line', line => {
    let m
    try { m = JSON.parse(line) } catch { return }
    if (m.method === 'initialize') return send({ jsonrpc: '2.0', id: m.id, result: { protocolVersion: 1 } })
    if (m.method === 'session/new') return send({ jsonrpc: '2.0', id: m.id, result: { sessionId: 'session_abc' } })
    if (m.method === 'session/set_config_option') return send({ jsonrpc: '2.0', id: m.id, result: {} })
    if (m.method === 'session/cancel') return send({ jsonrpc: '2.0', id: asked, result: { stopReason: 'end_turn' } })
    if (m.method !== 'session/prompt') return
    turns += 1
    if (turns === 1) { asked = m.id; return chunk('working') }
    const id = m.id
    setTimeout(() => {
      chunk('STEERED')
      send({ jsonrpc: '2.0', id, result: { stopReason: 'end_turn' } })
    }, 1500)
  })
  .on('close', () => process.exit(0))
`

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
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: true }
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

  it('runs a terminal command, keeps valid bounded output, waits, and releases it', async () => {
    const dialog = kimiDialog('go', tmpDir('kimi-terminal'), reader())
    const sent: string[] = []
    dialog.connect?.(line => sent.push(line))
    const opened = dialog.answer(
      request(20, 'terminal/create', {
        command: process.execPath,
        args: ['-e', 'process.stdout.write("zero🙂last")'],
        env: [{ name: 'CREW_TERMINAL_TEST', value: 'yes' }],
        outputByteLimit: 8
      })
    )
    expect(opened).toHaveLength(1)
    const terminalId = JSON.parse(opened[0]).result.terminalId

    expect(dialog.answer(request(21, 'terminal/wait_for_exit', { terminalId }))).toEqual([])
    while (!sent.length) await new Promise(resolve => setTimeout(resolve, 10))
    expect(JSON.parse(sent[0])).toEqual({
      jsonrpc: '2.0',
      id: 21,
      result: { exitCode: 0, signal: null }
    })

    const output = JSON.parse(dialog.answer(request(22, 'terminal/output', { terminalId }))[0])
    expect(output.result).toEqual({
      output: '🙂last',
      truncated: true,
      exitStatus: { exitCode: 0, signal: null }
    })
    expect(JSON.parse(dialog.answer(request(23, 'terminal/release', { terminalId }))[0]).result).toEqual({})
    expect(JSON.parse(dialog.answer(request(24, 'terminal/output', { terminalId }))[0]).error.code).toBe(-32602)
    dialog.close?.()
  })

  it('kills a terminal command and still reports how it ended', async () => {
    const dialog = kimiDialog('go', tmpDir('kimi-terminal-kill'), reader())
    const sent: string[] = []
    dialog.connect?.(line => sent.push(line))
    const opened = dialog.answer(
      request(30, 'terminal/create', {
        command: process.execPath,
        args: ['-e', 'setInterval(() => {}, 1000)']
      })
    )
    const terminalId = JSON.parse(opened[0]).result.terminalId
    expect(JSON.parse(dialog.answer(request(31, 'terminal/kill', { terminalId }))[0]).result).toEqual({})
    expect(dialog.answer(request(32, 'terminal/wait_for_exit', { terminalId }))).toEqual([])
    while (!sent.length) await new Promise(resolve => setTimeout(resolve, 10))
    const ended = JSON.parse(sent[0]).result
    expect(ended.exitCode).toBeNull()
    expect(ended.signal).toBe('SIGKILL')
    dialog.close?.()
  })

  it('hands the requested working folder and environment to the terminal command', async () => {
    const cwd = tmpDir('kimi-terminal-env')
    const dialog = kimiDialog('go', cwd, reader())
    const sent: string[] = []
    dialog.connect?.(line => sent.push(line))
    const opened = dialog.answer(
      request(40, 'terminal/create', {
        command: process.execPath,
        args: ['-e', 'process.stdout.write(process.env.CREW_TERMINAL_TEST + "|" + process.cwd())'],
        env: [{ name: 'CREW_TERMINAL_TEST', value: 'yes' }],
        cwd
      })
    )
    const terminalId = JSON.parse(opened[0]).result.terminalId
    dialog.answer(request(41, 'terminal/wait_for_exit', { terminalId }))
    while (!sent.length) await new Promise(resolve => setTimeout(resolve, 10))
    const output = JSON.parse(dialog.answer(request(42, 'terminal/output', { terminalId }))[0]).result.output
    expect(output).toBe(`yes|${realpathSync(cwd)}`)
    dialog.close?.()
  })

  it('runs a shell command handed over as one string', async () => {
    const cwd = tmpDir('acp-terminal-shell')
    const dialog = kimiDialog('go', cwd, reader())
    const sent: string[] = []
    dialog.connect?.(line => sent.push(line))
    const command = process.platform === 'win32' ? 'cmd /d /s /c cd' : '/bin/sh -lc pwd'
    const opened = dialog.answer(request(50, 'terminal/create', { command, cwd }))
    const terminalId = JSON.parse(opened[0]).result.terminalId
    dialog.answer(request(51, 'terminal/wait_for_exit', { terminalId }))
    while (!sent.length) await new Promise(resolve => setTimeout(resolve, 10))
    const output = JSON.parse(dialog.answer(request(52, 'terminal/output', { terminalId }))[0]).result.output.trim()
    expect(realpathSync(output)).toBe(realpathSync(cwd))
    dialog.close?.()
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

  it('leaves the run open on a turn cancelled to make room for a steer', () => {
    expect(stopped('cancelled')).toEqual([])
  })
})

describe('steering a kimi run', () => {
  const live = (dialog: ReturnType<typeof kimiDialog>) => {
    dialog.begin()
    dialog.answer(reply(1, { protocolVersion: 1, agentCapabilities: {} }))
    dialog.answer(reply(2, OPENED))
    dialog.answer(reply(3, {}))
    return dialog
  }

  const started = () => live(kimiDialog('go', '/repo', reader()))

  const sent = (lines: string[]) => lines.map(line => JSON.parse(line))

  it('asks the turn already in flight to stand down', () => {
    const line = started().steer('stop and say pineapple')
    expect(line).not.toBeNull()
    const cancel = JSON.parse(line!)
    expect(cancel.method).toBe('session/cancel')
    expect(cancel.params).toEqual({ sessionId: 'session_abc' })
    expect(cancel.id).toBeUndefined()
  })

  it('carries what was typed into a turn of its own once the last one lets go', () => {
    const dialog = started()
    dialog.steer('say pineapple')
    const next = sent(dialog.answer(reply(4, { stopReason: 'cancelled' })))
    expect(next).toHaveLength(1)
    expect(next[0].method).toBe('session/prompt')
    expect(next[0].params.sessionId).toBe('session_abc')
    expect(next[0].params.prompt).toEqual([{ type: 'text', text: 'say pineapple' }])
  })

  it('says nothing twice over, so two written in one breath arrive together', () => {
    const dialog = started()
    dialog.steer('first')
    dialog.steer('second')
    const next = sent(dialog.answer(reply(4, { stopReason: 'cancelled' })))
    expect(next).toHaveLength(1)
    expect(next[0].params.prompt).toEqual([{ type: 'text', text: 'first\nsecond' }])
  })

  it('holds a message written before there is a turn to steer, so it queues instead', () => {
    expect(kimiDialog('go', '/repo', reader()).steer('too early')).toBeNull()
  })

  it('holds one written a breath after the turn ended, so it gets a run of its own', () => {
    const dialog = started()
    dialog.answer(reply(4, { stopReason: 'end_turn' }))
    expect(dialog.steer('too late')).toBeNull()
  })

  it('loses nothing when the turn it was steering fell over', () => {
    const dialog = started()
    dialog.steer('carry on')
    const next = sent(dialog.answer(failed(4, 'the turn fell over')))
    expect(next).toHaveLength(1)
    expect(next[0].method).toBe('session/prompt')
    expect(next[0].params.prompt).toEqual([{ type: 'text', text: 'carry on' }])
  })

  it('leaves the turn alone when nothing was written into it', () => {
    const dialog = started()
    expect(dialog.answer(reply(4, { stopReason: 'end_turn' }))).toEqual([])
  })

  it('holds the run open when the turn it steered ended before the cancel landed', async () => {
    const provider = makeCliProvider({
      name: 'kimifake',
      label: 'Kimi',
      command: process.execPath,
      args: () => ['-e', LATE_CANCEL],
      makeParser: kimiParser,
      dialog: (prompt, cwd, get) => kimiDialog(prompt, cwd, get)
    })
    let said = ''
    const run = provider.start('go', tmpDir('kimi-steer'), {
      onStep: step => {
        if (step.kind === 'text') said += step.text ?? ''
      }
    })
    while (!said.includes('working')) await new Promise(r => setTimeout(r, 25))
    expect(run.steer?.('do it the other way')).toBe(true)
    const { text } = await run.done
    expect(text).toContain('STEERED')
  }, 20000)
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
