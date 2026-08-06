import { describe, expect, it } from 'vitest'
import { claudeArgs, claudeEnv, claudeFields } from '../src/runner/providers/claude'
import { codexArgs, codexFields } from '../src/runner/providers/codex'
import { geminiArgs, geminiFields } from '../src/runner/providers/gemini'
import { kimiFields } from '../src/runner/providers/kimi'
import { kimiDialog } from '../src/runner/providers/kimi-acp'
import { thinkAsked } from '../src/runner/providers/local-chat'
import { localFields, localTuning } from '../src/runner/providers/local'
import { resolveSettings, type AgentSettingField } from '../src/shared/llm'

const settled = (fields: AgentSettingField[]) => resolveSettings(fields, {})

const reader = (settings: Record<string, string>) => (key: string) => settings[key] ?? ''

const asked = (fields: AgentSettingField[]) => reader(settled(fields))

const CLAUDE_TODAY = [
  '-p',
  '--input-format',
  'stream-json',
  '--output-format',
  'stream-json',
  '--verbose',
  '--include-partial-messages',
  '--thinking-display',
  'summarized',
  '--model',
  'claude-opus-5',
  '--effort',
  'high',
  '--permission-mode',
  'bypassPermissions',
  '--dangerously-skip-permissions'
]

describe('an agent made and left alone runs the way it always did', () => {
  it('claude asks for exactly what it asked for before there was anything to set', () => {
    expect(claudeArgs('hi', asked(claudeFields()))).toEqual(CLAUDE_TODAY)
  })

  it('claude is handed no environment of its own', () => {
    expect(claudeEnv(asked(claudeFields()))).toEqual({})
  })

  it('codex opens the app server and says nothing else on the command line', () => {
    expect(codexArgs('hi', asked(codexFields()))).toEqual(['app-server'])
  })

  it('gemini keeps the flag pair it has always run under', () => {
    expect(geminiArgs('hi', asked(geminiFields()))).toEqual(['--acp', '--yolo'])
  })

  it('kimi says only the mode it has always said', () => {
    const dialog = kimiDialog('hi', '/tmp/work', asked(kimiFields()))
    dialog.begin()
    dialog.answer(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { protocolVersion: 1 } }))
    const said = dialog.answer(JSON.stringify({ jsonrpc: '2.0', id: 2, result: { sessionId: 's1' } }))
    expect(JSON.parse(said[said.length - 1]).params).toEqual({
      sessionId: 's1',
      configId: 'mode',
      value: 'yolo'
    })
  })

  it('local still asks a model to think the way it always has', () => {
    expect(thinkAsked(localTuning(asked(localFields())).think)).toBe(true)
  })

  it('local asks for nothing else about how the model answers', () => {
    const tuning = localTuning(asked(localFields()))
    expect([tuning.temperature, tuning.topP, tuning.seed, tuning.maxReply, tuning.keepAlive]).toEqual([
      '',
      '',
      '',
      '',
      ''
    ])
  })
})

describe('what a person picks is what goes out', () => {
  it('claude carries standing instructions and the folders it may read', () => {
    const args = claudeArgs(
      'hi',
      reader({ ...settled(claudeFields()), instructions: 'Be terse.', dirs: '~/spec, ~/notes' })
    )
    expect(args.join(' ')).toContain('--append-system-prompt Be terse.')
    expect(args.slice(args.indexOf('--add-dir'), args.indexOf('--add-dir') + 3)).toEqual([
      '--add-dir',
      '~/spec',
      '~/notes'
    ])
  })

  it('claude never leaves a list flag with the next flag missing behind it', () => {
    const args = claudeArgs('hi', reader({ ...settled(claudeFields()), dirs: '~/spec' }))
    expect(args[args.length - 1]).toBe('--dangerously-skip-permissions')
    expect(args[args.indexOf('--add-dir') + 2]).toMatch(/^--/)
  })

  it('claude leaves the machine out when it is asked to', () => {
    const args = claudeArgs('hi', reader({ ...settled(claudeFields()), crewOnly: 'on' }))
    expect(args[args.indexOf('--setting-sources') + 1]).toBe('')
  })

  it('claude sets both ends of the command timeout together', () => {
    expect(claudeEnv(reader({ commandMs: '240000' }))).toEqual({
      BASH_DEFAULT_TIMEOUT_MS: '240000',
      BASH_MAX_TIMEOUT_MS: '240000'
    })
  })

  it('codex writes its config in the toml a -c takes', () => {
    const args = codexArgs('hi', reader({ ...settled(codexFields()), search: 'live', verbosity: 'low' }))
    expect(args).toEqual(['app-server', '-c', 'web_search="live"', '-c', 'model_verbosity="low"'])
  })

  it('gemini never says yolo and an approval mode in one breath', () => {
    const args = geminiArgs('hi', reader({ ...settled(geminiFields()), mode: 'plan' }))
    expect(args).toContain('--approval-mode')
    expect(args).not.toContain('--yolo')
  })

  it('kimi says thinking as the word it reads, never as a boolean', () => {
    const dialog = kimiDialog('hi', '/tmp/work', reader({ ...settled(kimiFields()), thinking: 'on' }))
    dialog.begin()
    dialog.answer(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { protocolVersion: 1 } }))
    let said = dialog.answer(JSON.stringify({ jsonrpc: '2.0', id: 2, result: { sessionId: 's1' } }))
    said = dialog.answer(JSON.stringify({ jsonrpc: '2.0', id: 3, result: {} }))
    const sent = JSON.parse(said[said.length - 1]).params
    expect(sent).toEqual({ sessionId: 's1', configId: 'thinking', value: 'on' })
    expect(typeof sent.value).toBe('string')
  })

  it('local turns thinking off with the word the runtime takes', () => {
    expect(thinkAsked('off')).toBe(false)
    expect(thinkAsked('max')).toBe('max')
  })
})
