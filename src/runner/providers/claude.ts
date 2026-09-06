import { choices, flag, makeCliProvider, type SettingReader } from './cli'
import { activityDetail, fileChanges, stepTodos } from './detail'
import { ON, type AgentSettingField } from '../../shared/llm'
import { resultText } from './output'
import { taskCall } from './tasks'
import { usageFrom } from './tokens'
import { claudeUsage } from './usage'
import { CLAUDE_ACCOUNT_KEY, claudeConfigDir } from './claude-profile'
import { claudeModels, refreshClaudeModels } from './claude-models'
import type { Dialog, OutputParser, ParsedOutput, Provider, RunOptions } from './types'

const SUBAGENT_TOOLS = new Set(['Task'])
// A failure that has no message of its own still has a reason, and these are
// the ones the CLI names rather than describes.
const FAILURES: Record<string, string> = {
  error_max_turns: 'Claude reached its limit of turns before it finished.',
  error_during_execution: 'Claude stopped partway through the run.',
  api_error: 'Claude could not reach the model.',
  refusal: 'Claude declined to answer this one.'
}

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

// Claude puts what went wrong in its output rather than on stderr, and exits 1
// with nothing printed, so without this every failure read as an exit code.
function claudeFailure(msg: any): string {
  return (
    str(msg?.result) ||
    str(msg?.error) ||
    str(msg?.error?.message) ||
    FAILURES[str(msg?.subtype)] ||
    FAILURES[str(msg?.terminal_reason)] ||
    ''
  )
}

const apiErrorText = (content: unknown[]): string =>
  content
    .map(block => ((block as any)?.type === 'text' ? str((block as any).text) : ''))
    .filter(Boolean)
    .join('\n')

export const parseClaudeLine: OutputParser = line => {
  let msg: any
  try {
    msg = JSON.parse(line)
  } catch {
    return []
  }
  if (msg?.type === 'stream_event' && msg.event) {
    const event = msg.event
    if (event.type === 'content_block_start') {
      if (event.content_block?.type === 'thinking') return [{ thinkingStart: { index: event.index } }]
      if (event.content_block?.type === 'text') return [{ textStart: { index: event.index } }]
      return []
    }
    if (event.type === 'content_block_delta') {
      if (event.delta?.type === 'thinking_delta' && typeof event.delta.thinking === 'string') {
        return [{ thinkingDelta: { index: event.index, text: event.delta.thinking } }]
      }
      if (event.delta?.type === 'text_delta' && typeof event.delta.text === 'string') {
        return [{ textDelta: { index: event.index, text: event.delta.text } }]
      }
      return []
    }
    if (event.type === 'content_block_stop') {
      return [{ blockStop: { index: event.index } }]
    }
    return []
  }
  if (msg?.type === 'assistant' && Array.isArray(msg.message?.content)) {
    // An API error arrives as a message from the model itself. It is what went
    // wrong rather than something the agent said, so it is reported as one.
    if (msg.is_api_error_message) {
      return [{ error: apiErrorText(msg.message.content) || FAILURES.api_error }]
    }
    const out = []
    for (const block of msg.message.content) {
      if (block?.type === 'thinking' && typeof block.thinking === 'string' && block.thinking.trim()) {
        out.push({ thinking: block.thinking })
      }
      if (block?.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
        out.push({ text: block.text })
      }
      if (block?.type === 'tool_use' && block.id && block.name) {
        out.push({
          activity: {
            id: block.id,
            kind: SUBAGENT_TOOLS.has(block.name) ? ('subagent' as const) : ('tool' as const),
            name: block.name,
            status: 'started' as const,
            detail: activityDetail(block.input),
            files: fileChanges(block.name, block.input),
            todos: stepTodos(block.input),
            task: taskCall(block.name, block.input)
          }
        })
      }
    }
    const usage = usageFrom(msg.message?.usage, msg.message?.model)
    if (usage) out.push({ usage })
    return out
  }
  if (msg?.type === 'result') {
    const out: ParsedOutput[] = [{ turnEnd: true }]
    // The end of a turn carries what the whole of it came to, and the CLI has
    // already priced it against the model it really used, cached prefixes and
    // all. That figure is the run's, so nothing here works one out.
    const usage = usageFrom(msg?.usage, msg?.model)
    const cost = typeof msg?.total_cost_usd === 'number' ? msg.total_cost_usd : undefined
    if (usage || cost !== undefined) out.push({ usage: { ...usage, cost, total: true } })
    // is_error is what says a run failed. The subtype still reads as a success
    // on an API error, so nothing here may go by that alone.
    if (msg.is_error) {
      const reason = claudeFailure(msg)
      if (reason) out.push({ error: reason })
    }
    return out
  }
  if (msg?.type === 'user' && Array.isArray(msg.message?.content)) {
    const out = []
    for (const block of msg.message.content) {
      if (block?.type === 'tool_result' && typeof block.tool_use_id === 'string') {
        out.push({
          activity: {
            id: block.tool_use_id,
            kind: 'tool' as const,
            name: '',
            status: 'finished' as const,
            output: resultText(block.content)
          }
        })
      }
    }
    return out
  }
  return []
}

export const NO_THINKING = 'off'

const EFFORTS = [...choices(['low', 'medium', 'high', 'xhigh', 'max']), { value: NO_THINKING, label: 'Off' }]

export const claudeFields = (): AgentSettingField[] => {
  const models = claudeModels()
  return [
    {
    key: CLAUDE_ACCOUNT_KEY,
    label: 'Account',
    kind: 'text',
    default: '',
    placeholder: 'Default',
    action: 'claude-login'
  },
    { key: 'model', label: 'Model', options: [{ value: '', label: 'Default' }, ...models], default: '', free: true },
    {
      key: 'opusModel',
      label: 'Version',
      kind: 'text',
      default: '',
      visibleWhen: { key: 'model', value: '__legacy_opus_version__' }
    },
  { key: 'effort', label: 'Thinking', options: EFFORTS, default: 'high' },
  {
    key: 'instructions',
    label: 'Instructions',
    kind: 'paragraph',
    default: '',
    advanced: true,
    placeholder: 'None',
    line: 'Read before every message.'
  },
  {
    key: 'fallbackModel',
    label: 'If the model is busy',
    options: [{ value: '', label: 'None' }, ...models],
    default: '',
    free: true,
    advanced: true,
    section: 'Model'
  },
  {
    key: 'dirs',
    label: 'Other folders it can read',
    kind: 'text',
    default: '',
    advanced: true,
    section: 'On this computer',
    placeholder: 'None',
    line: 'Separated by commas.'
  },
  {
    key: 'crewOnly',
    label: 'Same on every machine',
    kind: 'switch',
    default: '',
    advanced: true,
    section: 'On this computer',
    line: 'Leaves out whatever each person set up in Claude for themselves.'
  },
  {
    key: 'commandSeconds',
    label: 'Longest a command may run',
    kind: 'number',
    default: '',
    advanced: true,
    section: 'On this computer',
    min: 1,
    max: 3600,
    unit: 'seconds'
    }
  ]
}

const list = (value: string): string[] =>
  value
    .split(',')
    .map(one => one.trim())
    .filter(Boolean)

export const claudeEnv = (get: SettingReader): NodeJS.ProcessEnv => {
  const config = claudeConfigDir(get(CLAUDE_ACCOUNT_KEY))
  const seconds = Number(get('commandSeconds'))
  const timeout =
    Number.isFinite(seconds) && seconds > 0
      ? {
          BASH_DEFAULT_TIMEOUT_MS: String(Math.round(seconds * 1000)),
          BASH_MAX_TIMEOUT_MS: String(Math.round(seconds * 1000))
        }
      : {}
  return { ...(config ? { CLAUDE_CONFIG_DIR: config } : {}), ...timeout }
}

function claudeModel(get: SettingReader): string {
  const model = get('model')
  return model === 'opus' ? get('opusModel') || model : model
}

// The prompt is not passed in argv: with --input-format stream-json it goes in
// over stdin, which is also the channel later messages use to steer the run.
//
// --thinking-display is what makes the thinking readable. From Opus 4.7 on, the
// model's reasoning is withheld by default: the blocks still arrive, with a
// signature and an empty string where the words should be, so a run looks like
// it is thinking out loud and says nothing. The interactive CLI asks for the
// summary; a headless one does not, and crew is headless. Asking for it here is
// the whole of what puts the thinking on screen.
export const claudeArgs = (_prompt: string, get: SettingReader, run: RunOptions = {}): string[] => {
  const dirs = list(get('dirs'))
  return [
    '-p',
    '--input-format',
    'stream-json',
    '--output-format',
    'stream-json',
    '--verbose',
    '--include-partial-messages',
    '--thinking-display',
    'summarized',
    ...flag('--model', claudeModel(get)),
    ...(get('effort') === NO_THINKING ? ['--thinking', 'disabled'] : flag('--effort', get('effort'))),
    ...flag('--mcp-config', run.mcp?.file ?? ''),
    ...flag('--append-system-prompt', get('instructions').trim()),
    ...flag('--fallback-model', get('fallbackModel')),
    ...(dirs.length ? ['--add-dir', ...dirs] : []),
    ...(get('crewOnly') === ON ? ['--setting-sources', ''] : []),
    '--permission-mode',
    'bypassPermissions',
    '--dangerously-skip-permissions'
  ]
}

const userMessage = (text: string): string =>
  JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text }] } })

export const claudeDialog = (prompt: string, goal?: string): Dialog => ({
  begin: () => (goal ? [userMessage(`/goal ${goal}`), userMessage(prompt)] : [userMessage(prompt)]),
  answer: () => [],
  steer: text => userMessage(text)
})

const INSTALL_SH = 'curl -fsSL https://claude.ai/install.sh | bash'

export const claudeProvider: Provider = makeCliProvider({
  name: 'claude',
  label: 'Claude',
  command: 'claude',
  fields: claudeFields,
  args: claudeArgs,
  env: claudeEnv,
  parser: parseClaudeLine,
  discover: refreshClaudeModels,
  dialog: (prompt, _cwd, _get, run) => claudeDialog(prompt, run.goal),
  goalCommand: true,
  mcp: 'file',
  usage: claudeUsage,
  install: { darwin: INSTALL_SH, linux: INSTALL_SH, win32: 'irm https://claude.ai/install.ps1 | iex' }
})
