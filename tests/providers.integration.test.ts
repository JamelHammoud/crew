import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseClaudeLine } from '../src/runner/providers/claude'
import { grokArgs, grokDialog, grokFields, grokParser, grokProvider } from '../src/runner/providers/grok'
import { kimiParser } from '../src/runner/providers/kimi-acp'
import { tmpDir } from './helpers/session'
import { makeFakeProvider, fakeCliPath } from './helpers/fake-provider'
import { commandExists, makeCliProvider } from '../src/runner/providers/cli'
import { builtinProviders } from '../src/runner/providers/detect'
import { exitReason, failureText } from '../src/runner/providers/failure'
import { installCommand, runInstall } from '../src/runner/providers/install'
import { commandOutput, resultText } from '../src/runner/providers/output'
import { crewPath, resolveCommand, searchDirs } from '../src/runner/providers/path'
import type { Provider } from '../src/runner/providers/types'
import { Crews } from '../src/main/crews'

describe('fake provider contract', () => {
  const repo = tmpDir('providers')

  it('detects and runs, streaming chunks in order', async () => {
    const provider = makeFakeProvider()
    expect(await provider.detect()).toBe(true)
    const chunks: string[] = []
    const run = provider.start('hello there', repo, {
      onStep: step => {
        if (step.kind === 'text' && step.text) chunks.push(step.text)
      }
    })
    const { text } = await run.done
    expect(chunks).toEqual(['fake[', 'hello there', ']'])
    expect(text).toBe('fake[\nhello there\n]')
  })

  it('reports tool steps with start and finish', async () => {
    const provider = makeFakeProvider({ FAKE_CLI_ACTIVITY: '1' })
    const steps: Array<{ name?: string; status: string }> = []
    const run = provider.start('work', repo, {
      onStep: step => {
        if (step.kind === 'tool' || step.kind === 'subagent') steps.push({ name: step.name, status: step.status })
      }
    })
    await run.done
    expect(steps).toContainEqual({ name: 'Helper', status: 'running' })
    expect(steps.filter(s => s.status === 'done').length).toBe(2)
  })

  // A reply held back until its block closes is a run that says "Starting" for
  // as long as it takes to write, however fast the words arrive.
  it('posts the reply as it is written, under one step, and only once', async () => {
    const provider = makeFakeProvider({ FAKE_CLI_TEXT_STREAM: '1' })
    const steps: Array<{ id: string; text?: string; status: string }> = []
    const run = provider.start('answer', repo, {
      onStep: step => {
        if (step.kind === 'text') steps.push({ id: step.id, text: step.text, status: step.status })
      }
    })
    const { text } = await run.done
    expect(steps).toEqual([
      { id: 'b0', text: 'the answer ', status: 'running' },
      { id: 'b0', text: 'in pieces', status: 'running' },
      { id: 'b0', text: undefined, status: 'done' }
    ])
    expect(text).toBe('the answer in pieces')
  })

  it('reports thinking as its own step', async () => {
    const provider = makeFakeProvider({ FAKE_CLI_THINK: '1' })
    const thoughts: string[] = []
    const run = provider.start('ponder', repo, {
      onStep: step => {
        if (step.kind === 'thinking' && step.text) thoughts.push(step.text)
      }
    })
    const { text } = await run.done
    expect(thoughts).toEqual(['weighing the options'])
    expect(text).not.toContain('weighing the options')
  })

  // Every tool hands back its whole result, and a file read would fill the log
  // the crew syncs, so only a command keeps what it printed.
  it('keeps what a command printed and drops the rest', async () => {
    const provider = makeFakeProvider({ FAKE_CLI_OUTPUT: '1' })
    const outputs = new Map<string, string | undefined>()
    const run = provider.start('work', repo, {
      onStep: step => {
        if (step.kind === 'tool' && step.status === 'done') outputs.set(step.id, step.output)
      }
    })
    await run.done
    expect(outputs.get('tt2')).toBe('total 8 drwxr-xr-x 4 jamel staff 128 src')
    expect(outputs.get('tt3')).toBeUndefined()
  })

  it('rejects with stderr on failure', async () => {
    const provider = makeFakeProvider({ FAKE_CLI_FAIL: '1' })
    const run = provider.start('boom', repo, { onStep: () => {} })
    await expect(run.done).rejects.toThrow('fake cli failed')
  })

  it('sends a literal one-shot prompt through stdin', async () => {
    const provider = makeCliProvider({
      name: 'stdin',
      label: 'Stdin',
      command: process.execPath,
      args: () => [
        '-e',
        'let body = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", chunk => body += chunk); process.stdin.on("end", () => process.stdout.write(body))'
      ],
      stdinPrompt: true
    })
    const prompt = 'Build this on the design board "Untitled Board".\n{"kind":"note","text":"Hero section"}'
    const run = provider.start(prompt, repo, { onStep: () => {} })
    await expect(run.done).resolves.toEqual({ text: prompt })
  })

  it('says the goal in words to a CLI that has no command for one', async () => {
    const provider = makeCliProvider({
      name: 'goal',
      label: 'Goal',
      command: process.execPath,
      args: () => [
        '-e',
        'let body = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", chunk => body += chunk); process.stdin.on("end", () => process.stdout.write(body))'
      ],
      stdinPrompt: true
    })
    const run = provider.start(
      'You are an agent here.\n\nfinish the migration',
      repo,
      { onStep: () => {} },
      {},
      { goal: 'finish the migration' }
    )
    const { text } = await run.done
    expect(text).toContain('Keep working until it is met')
    expect(text).toContain('finish the migration')
    expect(text).toContain('You are an agent here.')
  })

  it('kill stops the run and rejects with Stopped', async () => {
    const provider = makeFakeProvider({ FAKE_CLI_DELAY_MS: '300' })
    const run = provider.start('slow', repo, { onStep: () => {} })
    run.kill()
    await expect(run.done).rejects.toThrow('Stopped')
  })
})

describe('kimi parser matches the real CLI format', () => {
  const update = (body: unknown): string =>
    JSON.stringify({ jsonrpc: '2.0', method: 'session/update', params: { sessionId: 's1', update: body } })

  it('parses streamed words, tool calls, and tool results', () => {
    const parse = kimiParser().parse

    expect(parse(update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'ok' } }))).toEqual([
      { textStart: { index: 1 } },
      { textDelta: { index: 1, text: 'ok' } }
    ])

    const started = parse(
      update({ sessionUpdate: 'tool_call', toolCallId: 'tool_123', title: 'Glob', kind: 'search', status: 'pending' })
    )
    expect(started).toEqual([
      { blockStop: { index: 1 } },
      { activity: { id: 'tool_123', kind: 'tool', name: 'Glob', status: 'started' } }
    ])

    const args = parse(
      update({
        sessionUpdate: 'tool_call_update',
        toolCallId: 'tool_123',
        title: 'Searching for *.md',
        status: 'in_progress',
        rawInput: { pattern: '*.md' }
      })
    )
    expect(args[0].activity?.name).toBe('Glob')
    expect(args[0].activity?.detail).toBe('*.md')

    const finished = parse(
      update({
        sessionUpdate: 'tool_call_update',
        toolCallId: 'tool_123',
        status: 'completed',
        rawOutput: 'AGENTS.md'
      })
    )
    expect(finished).toEqual([
      { activity: { id: 'tool_123', kind: 'tool', name: 'Glob', status: 'finished', output: 'AGENTS.md' } }
    ])

    const subagent = parse(
      update({ sessionUpdate: 'tool_call', toolCallId: 'tool_9', title: 'Agent', kind: 'other', status: 'pending' })
    )
    expect(subagent[0].activity?.kind).toBe('subagent')

    expect(parse(update({ sessionUpdate: 'available_commands_update', availableCommands: [] }))).toEqual([])
  })

  it('ends the turn on the stop reason the prompt answers with', () => {
    expect(kimiParser().parse('{"jsonrpc":"2.0","id":3,"result":{"stopReason":"end_turn"}}')).toEqual([
      { turnEnd: true }
    ])
  })
})

describe('claude parser matches the real CLI format', () => {
  it('parses text blocks, tool use, and tool results', () => {
    const text = parseClaudeLine(
      '{"type":"assistant","message":{"content":[{"type":"text","text":"ok"}],"role":"assistant"}}'
    )
    expect(text).toEqual([{ text: 'ok' }])

    const toolUse = parseClaudeLine(
      '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"toolu_1","name":"Bash","input":{"command":"ls -la"}}]}}'
    )
    expect(toolUse).toEqual([
      { activity: { id: 'toolu_1', kind: 'tool', name: 'Bash', status: 'started', detail: 'ls -la' } }
    ])

    const task = parseClaudeLine(
      '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"toolu_2","name":"Task","input":{"description":"Explore the repo"}}]}}'
    )
    expect(task[0].activity?.kind).toBe('subagent')
    expect(task[0].activity?.detail).toBe('Explore the repo')

    const result = parseClaudeLine(
      '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"toolu_1","content":"done"}]}}'
    )
    expect(result).toEqual([
      { activity: { id: 'toolu_1', kind: 'tool', name: '', status: 'finished', output: 'done' } }
    ])

    const blocks = parseClaudeLine(
      '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"toolu_1","content":[{"type":"text","text":"two files"}]}]}}'
    )
    expect(blocks[0].activity?.output).toBe('two files')

    const thinking = parseClaudeLine(
      '{"type":"assistant","message":{"content":[{"type":"thinking","thinking":"let me check"},{"type":"text","text":"ok"}]}}'
    )
    expect(thinking).toEqual([{ thinking: 'let me check' }, { text: 'ok' }])

    expect(parseClaudeLine('{"type":"system","subtype":"init"}')).toEqual([])
    // A result ends the turn; in streaming-input mode that is what lets the run
    // close stdin instead of waiting forever for another message.
    expect(parseClaudeLine('{"type":"result","subtype":"success","result":"ok"}')).toEqual([{ turnEnd: true }])
    expect(parseClaudeLine('{"type":"result","subtype":"success","usage":{"output_tokens":12}}')).toEqual([
      { turnEnd: true },
      { usage: { output: 12, total: true } }
    ])
  })

  // Claude writes what went wrong into its output and exits 1 with nothing on
  // stderr, so a failure read as an exit code until the parser picked this up.
  it('reads the reason a run failed out of the run itself', () => {
    expect(
      parseClaudeLine(
        '{"type":"result","subtype":"success","is_error":true,"terminal_reason":"api_error","api_error_status":404,"result":"There is an issue with the selected model. It may not exist or you may not have access to it."}'
      )
    ).toEqual([
      { turnEnd: true },
      { error: 'There is an issue with the selected model. It may not exist or you may not have access to it.' }
    ])

    // The subtype still reads as a success on an API error, so is_error is the
    // only thing that says a run failed.
    expect(parseClaudeLine('{"type":"result","subtype":"success","is_error":false,"result":"ok"}')).toEqual([
      { turnEnd: true }
    ])

    expect(parseClaudeLine('{"type":"result","subtype":"error_max_turns","is_error":true}')).toEqual([
      { turnEnd: true },
      { error: 'Claude reached its limit of turns before it finished.' }
    ])

    // An API error arrives as a message from the model. It is what went wrong,
    // not something the agent said.
    expect(
      parseClaudeLine(
        '{"type":"assistant","is_api_error_message":true,"error":"model_not_found","message":{"content":[{"type":"text","text":"Credit balance is too low."}]}}'
      )
    ).toEqual([{ error: 'Credit balance is too low.' }])

    expect(parseClaudeLine('{"type":"assistant","is_api_error_message":true,"message":{"content":[]}}')).toEqual([
      { error: 'Claude could not reach the model.' }
    ])
  })
})

describe('a run that failed says why', () => {
  const repo = tmpDir('failures')

  const failing = (script: string, label = 'Fake'): Provider =>
    makeCliProvider({
      name: 'failing',
      label,
      command: process.execPath,
      args: () => ['-e', script],
      parser: parseClaudeLine
    })

  it('carries the reason out of the run rather than the code it exited with', async () => {
    const line = JSON.stringify({
      type: 'result',
      subtype: 'success',
      is_error: true,
      terminal_reason: 'api_error',
      result: 'Claude Code is out of usage for now. It comes back at 4pm.'
    })
    const provider = failing(`process.stdout.write(${JSON.stringify(line + '\n')}); process.exit(1)`, 'Claude')
    const run = provider.start('hi', repo, { onStep: () => {} })
    await expect(run.done).rejects.toThrow('Claude Code is out of usage for now. It comes back at 4pm.')
  })

  it('puts a run that printed nothing at all in words', async () => {
    const run = failing('process.exit(1)').start('hi', repo, { onStep: () => {} })
    await expect(run.done).rejects.toThrow('Fake stopped without saying why (exit code 1).')
  })

  it('says the machine stopped a run rather than reporting no code at all', async () => {
    const run = failing("process.kill(process.pid, 'SIGKILL')").start('hi', repo, { onStep: () => {} })
    await expect(run.done).rejects.toThrow(
      'Fake was stopped by this machine, which usually means it ran out of memory.'
    )
  })

  it('keeps the end of what was printed on the way out, without the colors', () => {
    expect(failureText('[31mnothing to see[0m\n\n  broke here  \n')).toBe('nothing to see\n  broke here')
    const many = Array.from({ length: 40 }, (_, i) => `line ${i}`).join('\n')
    expect(failureText(many).split('\n')).toEqual([
      'line 32',
      'line 33',
      'line 34',
      'line 35',
      'line 36',
      'line 37',
      'line 38',
      'line 39'
    ])
    expect(failureText('   \n  \n')).toBe('')
  })

  it('names a command that was never there', () => {
    expect(exitReason('Codex', 127, null)).toBe('Codex could not be found on this machine.')
    expect(exitReason('Codex', null, 'SIGTERM')).toBe('Codex was stopped before it finished.')
    expect(exitReason('Codex', null, null)).toBe('Codex stopped without saying why.')
  })
})

describe('a step says what it is about', () => {
  const detail = (name: string, input: unknown): string | undefined =>
    parseClaudeLine(
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'tool_use', id: 't1', name, input }] }
      })
    )[0].activity?.detail

  it('shows the thing asked for rather than the arguments it came in', () => {
    expect(detail('WebSearch', { query: 'pooling llms' })).toBe('pooling llms')
    expect(detail('WebFetch', { url: 'https://crew.dev/docs', prompt: 'summarize' })).toBe('https://crew.dev/docs')
    expect(detail('Grep', { pattern: 'AgentIcon', path: 'src' })).toBe('AgentIcon')
  })

  it('shows what was run rather than the summary written of it', () => {
    expect(detail('Bash', { command: 'yarn test --run', description: 'Run the full test suite' })).toBe(
      'yarn test --run'
    )
    expect(detail('Task', { description: 'Explore the repo', prompt: 'look around' })).toBe('Explore the repo')
  })

  it('shows the step someone is on rather than the whole list', () => {
    const todos = [
      { content: 'Read the icons', status: 'completed' },
      { content: 'Draw the rows', activeForm: 'Drawing the rows', status: 'in_progress' }
    ]
    expect(detail('TodoWrite', { todos })).toBe('Drawing the rows')
    expect(detail('TodoWrite', { todos: [{ content: 'Read the icons', status: 'pending' }] })).toBe('Read the icons')
  })
})

describe('grok parser matches the real streaming-json format', () => {
  const parser = grokParser()
  const parse = (event: unknown) => parser.parse(JSON.stringify(event))

  it('ignores noise and unparseable lines', () => {
    expect(parser.parse('not json')).toEqual([])
    expect(parse({ type: 'available_commands', tools: [] })).toEqual([])
    expect(parse({ type: 'tool_call' })).toEqual([])
  })

  it('streams text and thinking fragments into separate lanes', () => {
    expect(parse({ type: 'thought', data: 'let ' })).toEqual([
      { thinkingStart: { index: 1 } },
      { thinkingDelta: { index: 1, text: 'let ' } }
    ])
    expect(parse({ type: 'thought', data: 'me check' })).toEqual([{ thinkingDelta: { index: 1, text: 'me check' } }])
    expect(parse({ type: 'text', data: 'ok' })).toEqual([
      { blockStop: { index: 1 } },
      { textStart: { index: 2 } },
      { textDelta: { index: 2, text: 'ok' } }
    ])
  })

  it('tracks tool calls and results, spotting subagents', () => {
    const call = parse({
      type: 'tool_call',
      toolCallId: 'c1',
      toolName: 'run_terminal_command',
      status: 'pending',
      rawInput: { command: 'ls -la' }
    })
    expect(call).toEqual([
      { blockStop: { index: 2 } },
      {
        activity: {
          id: 'c1',
          kind: 'tool',
          name: 'run_terminal_command',
          status: 'started',
          detail: 'ls -la'
        }
      }
    ])

    const sub = parse({
      type: 'tool_call',
      toolCallId: 'c2',
      toolName: 'spawn_subagent',
      status: 'pending',
      rawInput: { description: 'explore' }
    })
    expect(sub[0].activity?.kind).toBe('subagent')
    expect(sub[0].activity?.detail).toBe('explore')

    expect(
      parse({
        type: 'tool_call_update',
        toolCallId: 'c1',
        status: 'completed',
        rawOutput: { output_for_prompt: 'exit: 0\ndone' }
      })
    ).toEqual([
      {
        activity: {
          id: 'c1',
          kind: 'tool',
          name: 'run_terminal_command',
          status: 'finished',
          output: 'exit: 0\ndone'
        }
      }
    ])
  })

  it('reports final tokens, cost, completion, and errors', () => {
    expect(
      parse({
        type: 'end',
        usage: { input_tokens: 10, output_tokens: 7, cache_read_input_tokens: 4 },
        total_cost_usd: 0.01,
        modelUsage: { 'grok-4.6-build': {} }
      })
    ).toEqual([
      {
        usage: {
          model: 'grok-4.6-build',
          input: 10,
          output: 7,
          cacheRead: 4,
          cacheWrite: undefined,
          cost: 0.01,
          total: true
        }
      },
      { turnEnd: true }
    ])
    expect(parse({ type: 'error', message: 'Not signed in.' })).toEqual([{ error: 'Not signed in.' }])
  })

  it('passes through the model returned by Grok discovery', () => {
    expect(grokArgs('hi', key => (key === 'model' ? 'grok-new' : key === 'mode' ? 'anything' : ''))).toContain(
      'grok-new'
    )
  })

  it('puts the agent controls in the settings they belong to', () => {
    const fields = grokFields()
    expect(fields.filter(field => !field.advanced).map(field => field.key)).toEqual(['model', 'effort'])
    expect(fields.filter(field => field.advanced).map(field => field.key)).toEqual([
      'instructions',
      'mode',
      'sandbox',
      'web',
      'planning',
      'subagents',
      'memory',
      'tools',
      'disallowedTools',
      'maxTurns'
    ])
    expect(fields.find(field => field.key === 'maxTurns')?.min).toBe(1)
  })

  it('opens one live session and turns a steer into its next prompt', () => {
    const dialog = grokDialog('start here', '/repo', () => '')
    const begin = JSON.parse(dialog.begin()[0])
    expect(begin.method).toBe('initialize')
    expect(begin.params.clientCapabilities.terminal).toBe(true)

    const opened = dialog.answer(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { protocolVersion: 1 } }))
    expect(JSON.parse(opened[0])).toMatchObject({ id: 2, method: 'session/new', params: { cwd: '/repo' } })

    const started = dialog.answer(JSON.stringify({ jsonrpc: '2.0', id: 2, result: { sessionId: 'grok-session' } }))
    expect(JSON.parse(started[0])).toMatchObject({
      id: 3,
      method: 'session/prompt',
      params: { sessionId: 'grok-session', prompt: [{ type: 'text', text: 'start here' }] }
    })

    expect(JSON.parse(dialog.steer('change direction')!)).toEqual({
      jsonrpc: '2.0',
      method: 'session/cancel',
      params: { sessionId: 'grok-session' }
    })
    const steered = dialog.answer(JSON.stringify({ jsonrpc: '2.0', id: 3, result: { stopReason: 'cancelled' } }))
    expect(JSON.parse(steered[0])).toMatchObject({
      id: 4,
      method: 'session/prompt',
      params: { sessionId: 'grok-session', prompt: [{ type: 'text', text: 'change direction' }] }
    })
    expect(grokProvider.steerable).toBe(true)
  })

  it('reads Grok agent events and completes only the final turn', () => {
    const live = grokParser()
    const note = (update: Record<string, unknown>) =>
      live.parse(
        JSON.stringify({
          jsonrpc: '2.0',
          method: 'session/update',
          params: { sessionId: 'grok-session', update }
        })
      )

    expect(note({ sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'checking' } })).toEqual([
      { thinkingStart: { index: 1 } },
      { thinkingDelta: { index: 1, text: 'checking' } }
    ])
    expect(note({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'working' } })).toEqual([
      { blockStop: { index: 1 } },
      { textStart: { index: 2 } },
      { textDelta: { index: 2, text: 'working' } }
    ])
    expect(
      note({
        sessionUpdate: 'tool_call',
        toolCallId: 'call-1',
        title: 'run_terminal_command',
        status: 'pending',
        rawInput: { command: 'pwd' }
      })[1].activity
    ).toMatchObject({ name: 'run_terminal_command', status: 'started', detail: 'pwd' })

    expect(live.parse(JSON.stringify({ jsonrpc: '2.0', id: 3, result: { stopReason: 'cancelled' } }))).toEqual([])
    expect(
      live.parse(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 4,
          result: {
            stopReason: 'end_turn',
            _meta: {
              modelId: 'grok-4.6',
              usage: { inputTokens: 100, outputTokens: 8, cachedReadTokens: 40, costUsdTicks: 25000000 }
            }
          }
        })
      )
    ).toEqual([
      {
        usage: {
          model: 'grok-4.6',
          input: 60,
          output: 8,
          cacheRead: 40,
          cost: 0.025,
          total: true
        }
      },
      { turnEnd: true }
    ])
  })
})

describe('what a command printed', () => {
  it('drops the colors and the cursor moves a terminal would have eaten', () => {
    expect(commandOutput('\u001b[32mpassed\u001b[0m')).toBe('passed')
    expect(commandOutput('one\u001b[2Ktwo')).toBe('onetwo')
    expect(commandOutput('  \n\n  ')).toBeUndefined()
    expect(commandOutput(undefined)).toBeUndefined()
  })

  it('keeps both ends of a long run, since a failure is at the end', () => {
    const lines = Array.from({ length: 200 }, (_, i) => `line ${i + 1}`)
    const kept = commandOutput(lines.join('\n'))!.split('\n')
    expect(kept[0]).toBe('line 1')
    expect(kept[kept.length - 1]).toBe('line 200')
    expect(kept.length).toBeLessThan(45)
    expect(kept.some(line => line.includes('left out'))).toBe(true)
  })

  it('holds a size a synced log can carry, however wide the lines', () => {
    const wide = Array.from({ length: 200 }, () => 'x'.repeat(2000)).join('\n')
    expect(commandOutput(wide)!.length).toBeLessThanOrEqual(4000)
  })

  it('reads a result given as content blocks the same as a plain string', () => {
    expect(
      resultText([
        { type: 'text', text: 'first' },
        { type: 'text', text: 'second' }
      ])
    ).toBe('first\nsecond')
    expect(resultText('plain')).toBe('plain')
    expect(resultText({ nope: true })).toBeUndefined()
  })
})

describe('provider install', () => {
  const installProvider = (command: string): Provider => ({
    name: 'fakeinstall',
    label: 'FakeInstall',
    fields: () => [],
    detect: async () => false,
    start: () => ({ done: Promise.reject(new Error('not runnable')), kill: () => {} }),
    install: { darwin: command, linux: command, win32: command }
  })

  it('every builtin provider has an installer for the desktop platforms', () => {
    expect(builtinProviders.map(p => p.name)).toEqual(['claude', 'codex', 'gemini', 'kimi', 'grok', 'local'])
    for (const provider of builtinProviders) {
      for (const platform of ['darwin', 'linux', 'win32']) {
        expect(installCommand(provider, platform), `${provider.name} on ${platform}`).toBeTruthy()
      }
      expect(installCommand(provider, 'freebsd')).toBeNull()
    }
  })

  it('runs the platform command and resolves on success', async () => {
    const dir = tmpDir('install')
    const marker = path.join(dir, 'installed')
    const command =
      process.platform === 'win32'
        ? `Set-Content -NoNewline -LiteralPath '${marker.replace(/'/g, "''")}' -Value 'ok'`
        : `printf ok > "${marker}"`
    await runInstall(installProvider(command))
    expect(fs.readFileSync(marker, 'utf8')).toBe('ok')
  })

  it('rejects with the installer output on failure', async () => {
    const command = process.platform === 'win32' ? 'Write-Error boom; exit 3' : 'echo boom >&2; exit 3'
    await expect(runInstall(installProvider(command))).rejects.toThrow(/boom/)
  })

  it('rejects when the platform has no installer', async () => {
    await expect(runInstall(installProvider('true'), 'freebsd')).rejects.toThrow(/does not know how to install/)
  })
})

describe('capabilities list every builtin provider', () => {
  it('marks each one installed or not instead of hiding it', async () => {
    const caps = await new Crews().capabilities()
    expect(caps.map(c => c.provider)).toEqual(['claude', 'codex', 'gemini', 'kimi', 'grok', 'local'])
    expect(caps.map(c => c.label)).toEqual(['Claude', 'Codex', 'Gemini', 'Kimi', 'Grok', 'Ollama'])
    for (const cap of caps) {
      expect(typeof cap.installed).toBe('boolean')
      expect(cap.installable).toBe(true)
      expect(Array.isArray(cap.fields)).toBe(true)
    }
  })

  it('refuses to install a provider it does not know', async () => {
    await expect(new Crews().installProvider('nope')).rejects.toThrow(/Unknown provider/)
  })
})

const REAL = process.env.CREW_REAL_CLI === '1'
const realCli = (name: string) => (REAL && commandExists(name) ? it : it.skip)

describe('real CLI smoke (CREW_REAL_CLI=1)', () => {
  realCli('grok')(
    'grok answers',
    async () => {
      const { grokProvider } = await import('../src/runner/providers/grok')
      const run = grokProvider.start(
        'Reply with exactly: crew-ok',
        tmpDir('real-grok'),
        { onStep: () => {} },
        { model: 'grok-4.6', effort: 'low', web: '', planning: '', subagents: '' }
      )
      const { text } = await run.done
      expect(text).toContain('crew-ok')
    },
    90000
  )

  realCli('grok')(
    'grok runs a tool',
    async () => {
      const { grokProvider } = await import('../src/runner/providers/grok')
      const cwd = tmpDir('real-grok-tool')
      const steps: Array<{ name?: string; status: string; output?: string }> = []
      const run = grokProvider.start(
        'Use run_terminal_command to run pwd, then reply with exactly: tool-ok',
        cwd,
        {
          onStep: step => {
            if (step.kind === 'tool') steps.push({ name: step.name, status: step.status, output: step.output })
          }
        },
        { model: 'grok-4.6' }
      )
      const { text } = await run.done
      expect(text).toContain('tool-ok')
      expect(steps).toContainEqual({ name: 'run_terminal_command', status: 'running', output: undefined })
      expect(steps).toContainEqual({
        name: 'run_terminal_command',
        status: 'done',
        output: `exit: 0\n${fs.realpathSync(cwd)}`
      })
    },
    90000
  )

  realCli('grok')(
    'grok takes a steer',
    async () => {
      const { grokProvider } = await import('../src/runner/providers/grok')
      let started = () => {}
      const working = new Promise<void>(resolve => {
        started = resolve
      })
      const run = grokProvider.start(
        'Write a detailed history of programming languages in at least 10000 words.',
        tmpDir('real-grok-steer'),
        {
          onStep: step => {
            if (step.status === 'running') started()
          }
        },
        { model: 'grok-4.6', effort: 'low', web: '', planning: '', subagents: '' }
      )
      await Promise.race([
        working,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Grok did not start working.')), 30000))
      ])
      expect(run.steer?.('Stop that and reply with exactly: steered-ok')).toBe(true)
      const { text } = await run.done
      expect(text).toContain('steered-ok')
    },
    90000
  )

  realCli('kimi')(
    'kimi answers',
    async () => {
      const { kimiProvider } = await import('../src/runner/providers/kimi')
      const run = kimiProvider.start('Reply with exactly: crew-ok', tmpDir('real-kimi'), { onStep: () => {} })
      const { text } = await run.done
      expect(text).toContain('crew-ok')
    },
    90000
  )

  realCli('claude')(
    'claude answers',
    async () => {
      const { claudeProvider } = await import('../src/runner/providers/claude')
      const run = claudeProvider.start('Reply with exactly: crew-ok', tmpDir('real-claude'), { onStep: () => {} })
      const { text } = await run.done
      expect(text).toContain('crew-ok')
    },
    90000
  )
})

describe('cli detection outside the app PATH', () => {
  it('finds a cli installed in the home bin dirs when PATH is bare', () => {
    const fakeHome = tmpDir('home')
    const bin = path.join(fakeHome, '.local/bin')
    fs.mkdirSync(bin, { recursive: true })
    const tool = path.join(bin, 'crewtool')
    fs.writeFileSync(tool, '#!/bin/sh\necho ok\n')
    fs.chmodSync(tool, 0o755)

    const dirs = searchDirs({ home: fakeHome, path: '', loginShell: false })
    expect(commandExists('crewtool', dirs)).toBe(true)
    expect(resolveCommand('crewtool', dirs)).toBe(tool)
    expect(crewPath(dirs).split(path.delimiter)).toContain(bin)
    expect(commandExists('crewtool-missing', dirs)).toBe(false)
  })

  it('ignores directories and non executable files', () => {
    const fakeHome = tmpDir('home')
    const bin = path.join(fakeHome, '.local/bin')
    fs.mkdirSync(path.join(bin, 'crewdir'), { recursive: true })
    fs.writeFileSync(path.join(bin, 'crewplain'), 'not executable')
    fs.chmodSync(path.join(bin, 'crewplain'), 0o644)

    const dirs = searchDirs({ home: fakeHome, path: '', loginShell: false })
    expect(commandExists('crewdir', dirs)).toBe(false)
    expect(commandExists('crewplain', dirs)).toBe(process.platform === 'win32')
  })
})

describe('idle timeout', () => {
  const repo = tmpDir('idle')
  const nodeProvider = (script: string, idleTimeoutMs: number) =>
    makeCliProvider({
      name: 'hang',
      label: 'Hang',
      command: process.execPath,
      args: () => ['-e', script],
      idleTimeoutMs
    })

  it('kills a process that never emits output', async () => {
    const provider = nodeProvider('setTimeout(() => {}, 60000)', 200)
    const run = provider.start('hi', repo, { onStep: () => {} })
    await expect(run.done).rejects.toThrow(/no output for/)
  })

  it('does not kill a slow process that keeps streaming', async () => {
    // Runs 5x longer than the idle window: only a resetting clock lets it finish.
    const script =
      'let n = 0; const t = setInterval(() => { console.log("tick"); if (++n === 10) { clearInterval(t) } }, 60)'
    const provider = nodeProvider(script, 300)
    const run = provider.start('hi', repo, { onStep: () => {} })
    const { text } = await run.done
    expect(text.split('\n').filter(Boolean)).toHaveLength(10)
  })

  it('reports a parsed error over the generic timeout message', async () => {
    const provider = makeCliProvider({
      name: 'hang2',
      label: 'Hang2',
      command: process.execPath,
      args: () => ['-e', 'console.log(JSON.stringify({ error: "usage limit" })); setTimeout(() => {}, 60000)'],
      parser: line => [JSON.parse(line)],
      idleTimeoutMs: 200
    })
    const run = provider.start('hi', repo, { onStep: () => {} })
    await expect(run.done).rejects.toThrow(/usage limit/)
  })

  it('still reports a user stop as Stopped, not a timeout', async () => {
    const provider = nodeProvider('setTimeout(() => {}, 60000)', 60000)
    const run = provider.start('hi', repo, { onStep: () => {} })
    run.kill()
    await expect(run.done).rejects.toThrow('Stopped')
  })
})

describe('fake cli is on disk for spawned tests', () => {
  it('exists', () => {
    expect(fakeCliPath.endsWith('fake-cli.mjs')).toBe(true)
  })
})
