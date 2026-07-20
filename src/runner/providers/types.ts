import type { AgentSettingField, AgentSettings } from '../../shared/llm'

export interface ParsedActivity {
  id: string
  kind: 'tool' | 'subagent'
  name: string
  status: 'started' | 'finished'
  detail?: string
}

export interface ParsedOutput {
  text?: string
  activity?: ParsedActivity
  thinking?: string
  tokens?: number
}

export type OutputParser = (line: string) => ParsedOutput[]

export interface RunProgress {
  thinking?: string
  tokens?: number
}

export interface RunHooks {
  onChunk: (text: string) => void
  onActivity: (activity: ParsedActivity) => void
  onProgress?: (progress: RunProgress) => void
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
