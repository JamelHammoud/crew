import type { AgentSettingField, AgentSettings, AgentUsage, FileChange, RunStep } from '../../shared/llm'

export interface ParsedActivity {
  id: string
  kind: 'tool' | 'subagent'
  name: string
  status: 'started' | 'finished'
  detail?: string
  files?: FileChange[]
}

export interface ParsedOutput {
  text?: string
  thinking?: string
  thinkingStart?: { index: number }
  thinkingDelta?: { index: number; text: string }
  thinkingStop?: { index: number }
  activity?: ParsedActivity
  tokens?: number
  error?: string
  turnEnd?: boolean
}

export type OutputParser = (line: string) => ParsedOutput[]

export interface RunHooks {
  onStep: (step: RunStep) => void
  onTokens?: (tokens: number) => void
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
