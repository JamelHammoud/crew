import type { AgentSettingField, AgentSettings, AgentUsage, FileChange, RunStep, StepTodo } from '../../shared/llm'

// What one call of the model cost in tokens, as the CLI reports it. Every field
// is optional because no two CLIs report the same set.
export interface ParsedUsage {
  model?: string
  input?: number
  output?: number
  cacheRead?: number
  cacheWrite?: number
  // What the CLI worked out for itself. That is the real figure rather than an
  // estimate off a table, so it stands in for one wherever it is given.
  cost?: number
  // The whole turn rather than one call inside it, which is what the end of a
  // run hands back. It is counted in place of the parts, never beside them.
  total?: boolean
}

export interface ParsedActivity {
  id: string
  kind: 'tool' | 'subagent'
  name: string
  status: 'started' | 'finished'
  detail?: string
  output?: string
  files?: FileChange[]
  todos?: StepTodo[]
}

export interface ParsedOutput {
  text?: string
  thinking?: string
  thinkingStart?: { index: number }
  thinkingDelta?: { index: number; text: string }
  textStart?: { index: number }
  textDelta?: { index: number; text: string }
  blockStop?: { index: number }
  activity?: ParsedActivity
  usage?: ParsedUsage
  error?: string
  turnEnd?: boolean
}

export type OutputParser = (line: string) => ParsedOutput[]

export interface RunHooks {
  onStep: (step: RunStep) => void
  onTokens?: (tokens: number, cost: number | null) => void
}

export interface RunningPrompt {
  done: Promise<{ text: string }>
  kill: () => void
  // Push a message into the run that is already in flight. Returns false when
  // the run can no longer take one, so the caller can fall back to queueing.
  steer?: (text: string) => boolean
}

export type InstallCommands = Partial<Record<'darwin' | 'linux' | 'win32', string>>

export interface Provider {
  name: string
  label: string
  // Shell command that installs the CLI, keyed by process.platform.
  install?: InstallCommands
  // Whether start() returns a run that accepts steer().
  steerable?: boolean
  fields(): AgentSettingField[]
  detect(): Promise<boolean>
  start(prompt: string, cwd: string, hooks: RunHooks, settings?: AgentSettings): RunningPrompt
  // Reads the account's rate-limit state from this machine (credentials,
  // session logs). null means the provider has no usage data to offer.
  usage?(): Promise<AgentUsage | null>
}
