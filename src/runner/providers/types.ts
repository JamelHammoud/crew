import type { AgentSettingField, AgentSettings, FileChange, RunStep } from '../../shared/llm'

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
}

export type OutputParser = (line: string) => ParsedOutput[]

export interface RunHooks {
  onStep: (step: RunStep) => void
  onTokens?: (tokens: number) => void
}

export interface RunningPrompt {
  done: Promise<{ text: string }>
  kill: () => void
}

export interface Provider {
  name: string
  label: string
  fields(): AgentSettingField[]
  detect(): Promise<boolean>
  start(prompt: string, cwd: string, hooks: RunHooks, settings?: AgentSettings): RunningPrompt
}
