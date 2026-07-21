/// <reference types="vite/client" />

import type { AgentDef, AgentSettings, ProviderCapability } from '../../shared/llm'

declare global {
  interface CrewBridge {
    pickFolder(): Promise<string | null>
    start(folder: string, name: string): Promise<{ link: string; wsUrl: string }>
    join(link: string, folder: string, name: string): Promise<{ wsUrl: string }>
    leave(): Promise<void>
    current(): Promise<{ wsUrl: string; name: string; code: string; link: string | null } | null>
    agentCapabilities(): Promise<ProviderCapability[]>
    installProvider(provider: string): Promise<ProviderCapability[]>
    createAgent(input: { provider: string; name: string; settings: AgentSettings }): Promise<AgentDef>
    removeAgent(instanceId: string): Promise<void>
    onFullScreen(listener: (full: boolean) => void): void
  }

  interface Window {
    crew: CrewBridge
  }
}
