import { describe, expect, it } from 'vitest'
import { claudeArgs, claudeEnv, claudeFields } from '../src/runner/providers/claude'
import { claudeLoginCommand, claudeProfileId } from '../src/shared/claude'
import { claudeConfigDir } from '../src/runner/providers/claude-profile'
import { codexArgs, codexFields } from '../src/runner/providers/codex'
import { geminiArgs, geminiFields } from '../src/runner/providers/gemini'
import { grokArgs, grokEnv, grokFields } from '../src/runner/providers/grok'
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

  it('codex offers standing instructions with no default text', () => {
    expect(codexFields().find(field => field.key === 'instructions')).toMatchObject({
      label: 'Instructions',
      kind: 'paragraph',
      default: '',
      advanced: true
    })
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

  it('grok opens its agent connection with the same default permissions', () => {
    expect(grokArgs('hi', asked(grokFields()))).toEqual(['agent', '--always-approve', 'stdio'])
    expect(grokEnv(asked(grokFields()))).toEqual({})
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

  it('claude sets both ends of the command timeout together, in the seconds it was asked in', () => {
    expect(claudeEnv(reader({ commandSeconds: '240' }))).toEqual({
      BASH_DEFAULT_TIMEOUT_MS: '240000',
      BASH_MAX_TIMEOUT_MS: '240000'
    })
  })

  it('claude runs a named account in its own config directory', () => {
    expect(claudeEnv(reader({ account: 'Work Account' }))).toEqual({
      CLAUDE_CONFIG_DIR: claudeConfigDir('Work Account')
    })
  })

  it('claude turns an account name into one safe profile directory', () => {
    expect(claudeProfileId('../../Wörk Account')).toBe('work-account')
    expect(claudeConfigDir('../../Wörk Account', '/users/sam')).toBe('/users/sam/.crew/claude/work-account')
  })

  it('claude signs in through the same profile its agent uses', () => {
    expect(claudeLoginCommand('Work Account')).toBe(
      'CLAUDE_CONFIG_DIR="$HOME/.crew/claude/work-account" claude auth login --claudeai'
    )
    expect(claudeLoginCommand('')).toBe('claude auth login --claudeai')
  })

  it('claude turns thinking off through the one control that has an off', () => {
    const args = claudeArgs('hi', reader({ ...settled(claudeFields()), effort: 'off' }))
    expect(args.join(' ')).toContain('--thinking disabled')
    expect(args).not.toContain('--effort')
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

  it('grok carries every chosen run setting to the CLI', () => {
    const args = grokArgs(
      'hi',
      reader({
        ...settled(grokFields()),
        model: 'grok-4.6',
        effort: 'xhigh',
        instructions: 'Keep the answer short.',
        mode: 'plan',
        sandbox: 'read-only',
        web: '',
        planning: '',
        subagents: '',
        tools: 'read_file, grep',
        disallowedTools: 'write, image_gen',
        maxTurns: '12'
      })
    )
    expect(args).toEqual([
      '--permission-mode',
      'plan',
      '--rules',
      'Keep the answer short.',
      '--sandbox',
      'read-only',
      '--disable-web-search',
      '--no-plan',
      '--no-subagents',
      '--tools',
      'read_file, grep',
      '--disallowed-tools',
      'write, image_gen',
      '--max-turns',
      '12',
      'agent',
      '--model',
      'grok-4.6',
      '--reasoning-effort',
      'xhigh',
      'stdio'
    ])
  })

  it('grok changes memory only when somebody picks a value', () => {
    expect(grokEnv(reader({ memory: '' }))).toEqual({})
    expect(grokEnv(reader({ memory: 'on' }))).toEqual({ GROK_MEMORY: '1' })
    expect(grokEnv(reader({ memory: 'off' }))).toEqual({ GROK_MEMORY: '0' })
  })

  it('local turns thinking off with the word the runtime takes', () => {
    expect(thinkAsked('off')).toBe(false)
    expect(thinkAsked('max')).toBe('max')
  })
})
