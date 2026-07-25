/// <reference types="vite/client" />

import type { PathLocation, RepoFile } from '../../shared/files'
import type { AgentDef, AgentSettings, ProviderCapability } from '../../shared/llm'
import type { RepoActionResult, RepoChange, RepoStatus } from '../../shared/repository'
import type { RecentJoin } from '../../shared/recent'

declare global {
  interface CrewBridge {
    pickFolder(): Promise<string | null>
    start(folder: string, name: string): Promise<{ link: string; wsUrl: string }>
    join(link: string, folder: string, name: string): Promise<{ wsUrl: string }>
    leave(): Promise<void>
    current(): Promise<{ wsUrl: string; name: string; code: string; link: string | null } | null>
    recentJoins(): Promise<RecentJoin[]>
    agentCapabilities(): Promise<ProviderCapability[]>
    installProvider(provider: string): Promise<ProviderCapability[]>
    createAgent(input: { provider: string; name: string; settings: AgentSettings }): Promise<AgentDef>
    removeAgent(instanceId: string): Promise<void>
    repoStatus(): Promise<RepoStatus>
    repoChanges(): Promise<RepoChange[]>
    pullRepo(): Promise<RepoActionResult>
    pushRepo(): Promise<RepoActionResult>
    openExternal(url: string): Promise<void>
    readFile(path: string): Promise<RepoFile | null>
    writeFile(path: string, text: string): Promise<RepoFile | null>
    locatePath(path: string): Promise<PathLocation>
    revealFile(path: string): Promise<void>
    onFullScreen(listener: (full: boolean) => void): void
    onOpenUrl(listener: (url: string) => void): void
  }

  interface WebviewElement extends HTMLElement {
    src: string
    getURL(): string
    loadURL(url: string): Promise<void>
    reload(): void
    stop(): void
    goBack(): void
    goForward(): void
    canGoBack(): boolean
    canGoForward(): boolean
  }

  interface Window {
    crew: CrewBridge
  }
}
