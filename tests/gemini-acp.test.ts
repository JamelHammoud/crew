import { describe, expect, it } from 'vitest'
import { geminiArgs, geminiProvider } from '../src/runner/providers/gemini'
import { geminiDialog, geminiParser } from '../src/runner/providers/gemini-acp'
import { makeCliProvider } from '../src/runner/providers/cli'
import { tmpDir } from './helpers/session'
import type { ParsedActivity, ParsedOutput } from '../src/runner/providers/types'

const reader =
  (settings: Record<string, string> = {}) =>
  (key: string) =>
    settings[key] ?? ''

const reply = (id: number, result: unknown) => JSON.stringify({ jsonrpc: '2.0', id, result })

const failed = (id: number, message: string, code = -32000) =>
  JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })

const request = (id: number, method: string, params: unknown) =>
  JSON.stringify({ jsonrpc: '2.0', id, method, params })

const note = (body: Record<string, unknown>) =>
  JSON.stringify({ jsonrpc: '2.0', method: 'session/update', params: { sessionId: 'session_abc', update: body } })

const chunk = (kind: string, text: string) => note({ sessionUpdate: kind, content: { type: 'text', text } })

const call = (body: Record<string, unknown>) => note({ sessionUpdate: 'tool_call', ...body })

const change = (body: Record<string, unknown>) => note({ sessionUpdate: 'tool_call_update', ...body })

const acted = (out: ParsedOutput[]): ParsedActivity => out.find(one => one.activity)!.activity!

const sent = (dialog: ReturnType<typeof geminiDialog>, lines: string[]): any[] =>
  lines.flatMap(line => dialog.answer(line)).map(out => JSON.parse(out))

describe('the way in', () => {
  it('runs the protocol rather than the one shot flag', () => {
    expect(geminiArgs('go', reader())).toEqual(['--acp', '--yolo'])
  })

  it('says which model on the command rather than over the wire', () => {
    expect(geminiArgs('go', reader({ model: 'gemini-2.5-pro' }))).toEqual([
      '--acp',
      '--yolo',
      '--model',
      'gemini-2.5-pro'
    ])
  })

  it('takes a steer and says so', () => {
    expect(geminiProvider.steerable).toBe(true)
  })
})

describe('the handshake', () => {
  const walk = (settings: Record<string, string> = {}) => {
    const dialog = geminiDialog('add a line', '/work', reader(settings))
    const begin = dialog.begin().map(out => JSON.parse(out))
    return { dialog, begin }
  }

  it('opens on initialize, declining both hands and the terminal', () => {
    const { begin } = walk()
    expect(begin).toHaveLength(1)
    expect(begin[0].method).toBe('initialize')
    expect(begin[0].params.protocolVersion).toBe(1)
    expect(begin[0].params.clientCapabilities).toEqual({
      fs: { readTextFile: false, writeTextFile: false },
      terminal: false
    })
  })

  it('opens the session in the project folder once initialize is answered', () => {
    const { dialog, begin } = walk()
    const [asked] = sent(dialog, [reply(begin[0].id, { protocolVersion: 1 })])
    expect(asked.method).toBe('session/new')
    expect(asked.params.cwd).toBe('/work')
  })

  it('goes straight from the session to the turn, with no settings in between', () => {
    const { dialog, begin } = walk({ model: 'gemini-2.5-pro' })
    const [asked] = sent(dialog, [reply(begin[0].id, { protocolVersion: 1 })])
    const [turn] = sent(dialog, [reply(asked.id, { sessionId: 'session_abc' })])
    expect(turn.method).toBe('session/prompt')
    expect(turn.params.sessionId).toBe('session_abc')
    expect(turn.params.prompt).toEqual([{ type: 'text', text: 'add a line' }])
  })

  it('approves a permission it is asked for rather than leaving the run hanging', () => {
    const { dialog, begin } = walk()
    const [asked] = sent(dialog, [reply(begin[0].id, { protocolVersion: 1 })])
    sent(dialog, [reply(asked.id, { sessionId: 'session_abc' })])
    const [answer] = sent(dialog, [
      request(99, 'session/request_permission', {
        options: [
          { optionId: 'no', kind: 'reject_once', name: 'No' },
          { optionId: 'yes', kind: 'allow_always', name: 'Always' }
        ]
      })
    ])
    expect(answer.result.outcome).toEqual({ outcome: 'selected', optionId: 'yes' })
  })

  it('refuses a request it does not answer rather than saying nothing', () => {
    const { dialog } = walk()
    const [answer] = sent(dialog, [request(7, 'fs/read_text_file', { path: '/work/notes.txt' })])
    expect(answer.error.code).toBe(-32601)
  })
})

describe('what the model says', () => {
  it('streams thinking and the answer on lanes of their own', () => {
    const parse = geminiParser().parse
    expect(parse(chunk('agent_thought_chunk', '**Reading**\nthe file'))).toEqual([
      { thinkingStart: { index: 1 } },
      { thinkingDelta: { index: 1, text: '**Reading**\nthe file' } }
    ])
    expect(parse(chunk('agent_message_chunk', 'Added'))).toEqual([
      { blockStop: { index: 1 } },
      { textStart: { index: 2 } },
      { textDelta: { index: 2, text: 'Added' } }
    ])
    expect(parse(chunk('agent_message_chunk', ' the line.'))).toEqual([
      { textDelta: { index: 2, text: ' the line.' } }
    ])
  })

  it('never reuses a lane, so closing one cannot close another', () => {
    const parse = geminiParser().parse
    parse(chunk('agent_thought_chunk', 'one'))
    parse(chunk('agent_message_chunk', 'two'))
    const back = parse(chunk('agent_thought_chunk', 'three'))
    expect(back).toEqual([
      { blockStop: { index: 2 } },
      { thinkingStart: { index: 3 } },
      { thinkingDelta: { index: 3, text: 'three' } }
    ])
  })

  it('says nothing about a chunk with no words in it', () => {
    expect(geminiParser().parse(chunk('agent_message_chunk', ''))).toEqual([])
  })
})

describe('what a tool was', () => {
  it('names a tool by its kind rather than by the line it narrates itself with', () => {
    const parse = geminiParser().parse
    const out = parse(call({ toolCallId: 'c1', title: 'notes.txt', kind: 'read', status: 'in_progress' }))
    expect(acted(out).name).toBe('Read')
    expect(acted(out).detail).toBe('notes.txt')
    expect(acted(out).status).toBe('started')
  })

  it('speaks the app own words for every kind the protocol names', () => {
    const named = (kind: string): string => {
      const out = geminiParser().parse(call({ toolCallId: 'c1', title: 't', kind, status: 'in_progress' }))
      return acted(out).name
    }
    expect(named('read')).toBe('Read')
    expect(named('edit')).toBe('Edit')
    expect(named('execute')).toBe('Bash')
    expect(named('search')).toBe('Grep')
    expect(named('fetch')).toBe('WebFetch')
  })

  it('leaves a kind nobody has heard of as the word it arrived under', () => {
    const out = geminiParser().parse(call({ toolCallId: 'c1', title: 't', kind: 'other', status: 'in_progress' }))
    expect(acted(out).name).toBe('other')
  })

  it('reads a thinking tool as work sent out rather than as a tool', () => {
    const out = geminiParser().parse(call({ toolCallId: 'c1', title: 't', kind: 'think', status: 'in_progress' }))
    expect(acted(out).kind).toBe('subagent')
  })

  it('keeps the kind it started under when a later update says nothing about it', () => {
    const parse = geminiParser().parse
    parse(call({ toolCallId: 'c1', title: 'notes.txt', kind: 'execute', status: 'in_progress' }))
    const done = parse(change({ toolCallId: 'c1', status: 'completed' }))
    expect(acted(done).name).toBe('Bash')
    expect(acted(done).status).toBe('finished')
  })

  it('falls back to the file it names when it narrates nothing', () => {
    const out = geminiParser().parse(
      call({ toolCallId: 'c1', kind: 'read', status: 'in_progress', locations: [{ path: '/work/notes.txt' }] })
    )
    expect(acted(out).detail).toBe('/work/notes.txt')
  })

  it('says nothing about an update with no tool on it', () => {
    expect(geminiParser().parse(change({ status: 'completed' }))).toEqual([])
  })

  it('draws one step per tool rather than one per update while it runs', () => {
    const parse = geminiParser().parse
    parse(call({ toolCallId: 'c1', title: 'notes.txt', kind: 'read', status: 'in_progress' }))
    expect(parse(change({ toolCallId: 'c1', title: 'notes.txt', kind: 'read', status: 'in_progress' }))).toEqual([])
  })

  it('closes the block that was open as a tool arrives', () => {
    const parse = geminiParser().parse
    parse(chunk('agent_message_chunk', 'Reading it.'))
    const out = parse(call({ toolCallId: 'c1', title: 'notes.txt', kind: 'read', status: 'in_progress' }))
    expect(out[0]).toEqual({ blockStop: { index: 1 } })
  })
})

describe('what a tool did to a file', () => {
  const edited = (body: Record<string, unknown>) => {
    const parse = geminiParser().parse
    parse(call({ toolCallId: 'c1', title: 'notes.txt', kind: 'edit', status: 'in_progress' }))
    return acted(parse(change({ toolCallId: 'c1', status: 'completed', ...body })))
  }

  it('builds the change out of the diff it was handed', () => {
    const done = edited({
      content: [
        {
          type: 'diff',
          path: '/work/notes.txt',
          oldText: 'one\ntwo',
          newText: 'one\ntwo\nthree'
        }
      ]
    })
    expect(done.files).toEqual([
      {
        path: '/work/notes.txt',
        added: 3,
        removed: 2,
        diff: '- one\n- two\n+ one\n+ two\n+ three'
      }
    ])
  })

  it('reads a file that was written from nothing as an add', () => {
    const done = edited({
      content: [{ type: 'diff', path: '/work/new.txt', oldText: '', newText: 'hello' }]
    })
    expect(done.files).toEqual([{ path: '/work/new.txt', added: 1, removed: 0, diff: '+ hello' }])
  })

  it('says nothing about files where the tool printed words rather than a diff', () => {
    const done = edited({ content: [{ type: 'content', content: { type: 'text', text: 'done' } }] })
    expect(done.files).toBeUndefined()
    expect(done.output).toBe('done')
  })

  it('keeps what a command printed and lets a file read go', async () => {
    const lines = [
      call({ toolCallId: 'c1', title: 'echo done', kind: 'execute', status: 'in_progress' }),
      change({
        toolCallId: 'c1',
        status: 'completed',
        content: [{ type: 'content', content: { type: 'text', text: 'done' } }]
      }),
      call({ toolCallId: 'c2', title: 'notes.txt', kind: 'read', status: 'in_progress' }),
      change({
        toolCallId: 'c2',
        status: 'completed',
        content: [{ type: 'content', content: { type: 'text', text: 'export function add(a, b) {' } }]
      })
    ]
    const provider = makeCliProvider({
      name: 'geminifake',
      label: 'Gemini',
      command: process.execPath,
      args: () => ['-e', `for (const l of ${JSON.stringify(lines)}) process.stdout.write(l + '\\n')`],
      makeParser: geminiParser
    })
    const outputs = new Map<string, string | undefined>()
    const run = provider.start('go', tmpDir('gemini-acp'), {
      onStep: step => {
        if (step.kind === 'tool' && step.status === 'done') outputs.set(step.id, step.output)
      }
    })
    await run.done
    expect(outputs.get('tc1')).toBe('done')
    expect(outputs.get('tc2')).toBeUndefined()
  })
})

describe('the end of a turn', () => {
  const stopped = (stopReason: string) => geminiParser().parse(reply(3, { stopReason }))

  it('ends the turn on end_turn and says nothing about it', () => {
    expect(stopped('end_turn')).toEqual([{ turnEnd: true }])
  })

  it('says in a sentence why the model stopped short', () => {
    expect(stopped('max_tokens')).toEqual([
      { error: 'Gemini reached its token limit before it finished.' },
      { turnEnd: true }
    ])
    expect(stopped('max_turn_requests')).toEqual([
      { error: 'Gemini reached its limit of steps before it finished.' },
      { turnEnd: true }
    ])
  })

  it('says nothing at all about a turn that stood down for a steer', () => {
    expect(stopped('cancelled')).toEqual([])
  })

  it('closes the block that was still open as the turn ends', () => {
    const parse = geminiParser().parse
    parse(chunk('agent_message_chunk', 'Added the line.'))
    expect(parse(reply(3, { stopReason: 'end_turn' }))).toEqual([{ blockStop: { index: 1 } }, { turnEnd: true }])
  })

  it('ends the run when the session is refused, and says why', () => {
    expect(geminiParser().parse(failed(2, 'Gemini API key is missing or not configured.'))).toEqual([
      { error: 'Gemini API key is missing or not configured.' },
      { turnEnd: true }
    ])
  })
})

describe('a steer', () => {
  const started = () => {
    const dialog = geminiDialog('add a line', '/work', reader())
    const begin = dialog.begin().map(out => JSON.parse(out))
    const [asked] = sent(dialog, [reply(begin[0].id, { protocolVersion: 1 })])
    const [turn] = sent(dialog, [reply(asked.id, { sessionId: 'session_abc' })])
    return { dialog, turn }
  }

  it('has nothing to steer before a turn is going', () => {
    const dialog = geminiDialog('add a line', '/work', reader())
    dialog.begin()
    expect(dialog.steer('and a second one')).toBeNull()
  })

  it('stands the turn down rather than pushing a message into it', () => {
    const { dialog } = started()
    const out = JSON.parse(dialog.steer('and a second one')!)
    expect(out.method).toBe('session/cancel')
    expect(out.params.sessionId).toBe('session_abc')
    expect(out.id).toBeUndefined()
  })

  it('waits for the cancelled turn to answer before asking for the next one', () => {
    const { dialog, turn } = started()
    dialog.steer('and a second one')
    const after = sent(dialog, [reply(turn.id, { stopReason: 'cancelled' })])
    expect(after).toHaveLength(1)
    expect(after[0].method).toBe('session/prompt')
    expect(after[0].params.prompt).toEqual([{ type: 'text', text: 'and a second one' }])
  })

  it('says two written in one breath once rather than twice over', () => {
    const { dialog, turn } = started()
    dialog.steer('one')
    dialog.steer('two')
    const after = sent(dialog, [reply(turn.id, { stopReason: 'cancelled' })])
    expect(after).toHaveLength(1)
    expect(after[0].params.prompt).toEqual([{ type: 'text', text: 'one\ntwo' }])
  })

  it('asks for nothing more when a turn ends with nothing waiting', () => {
    const { dialog, turn } = started()
    expect(sent(dialog, [reply(turn.id, { stopReason: 'end_turn' })])).toEqual([])
  })
})
