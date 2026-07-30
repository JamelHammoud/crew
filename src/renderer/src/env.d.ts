/// <reference types="vite/client" />

import type { AgentAlert } from '../../shared/alerts'
import type { OpenRequest } from '../../shared/cli'
import type { CommandDone, CommandState } from '../../shared/crewCommand'
import type { PathLocation, RepoFile } from '../../shared/files'
import type { AgentDef, AgentSettings, ProviderCapability } from '../../shared/llm'
import type { MediaAccess, MediaKind, ScreenSource } from '../../shared/media'
import type { Present, PresenceSnapshot } from '../../shared/presence'
import type { RepoActionResult, RepoChange, RepoCommand, RepoStatus, RepoWork } from '../../shared/repository'
import type { RecentJoin, RecentProject } from '../../shared/recent'
import type { ScribeKeyState, ScribeSettings } from '../../shared/scribe'
import type { Said } from '../../shared/scribeSaid'
import type { CurrentSession, OpenOptions, ProjectPlan } from '../../shared/session'
import type { UpdateState } from '../../shared/update'

declare global {
  interface CrewBridge {
    pickFolder(): Promise<string | null>
    start(folder: string, name: string, opts?: OpenOptions): Promise<CurrentSession>
    join(link: string, folder: string, name: string): Promise<CurrentSession>
    leave(): Promise<void>
    current(): Promise<CurrentSession | null>
    recentJoins(): Promise<RecentJoin[]>
    projects(): Promise<RecentProject[]>
    forgetProject(folder: string): Promise<void>
    forgetJoin(link: string): Promise<void>
    opening(): Promise<OpenRequest | null>
    projectPlan(folder: string): Promise<ProjectPlan>
    setShared(shared: boolean): Promise<CurrentSession | null>
    agentCapabilities(): Promise<ProviderCapability[]>
    installProvider(provider: string): Promise<ProviderCapability[]>
    createAgent(input: { provider: string; name: string; settings: AgentSettings }): Promise<AgentDef>
    removeAgent(instanceId: string): Promise<void>
    repoStatus(): Promise<RepoStatus>
    repoChanges(): Promise<RepoChange[]>
    repoWork(): Promise<RepoWork>
    runRepo(command: RepoCommand): Promise<RepoActionResult>
    pullRepo(): Promise<RepoActionResult>
    pushRepo(): Promise<RepoActionResult>
    mediaAccess(kind: MediaKind): Promise<MediaAccess>
    askForMedia(kind: 'microphone' | 'camera'): Promise<boolean>
    openMediaSettings(kind: MediaKind): Promise<void>
    screenSources(): Promise<ScreenSource[]>
    pickScreenSource(id: string | null): Promise<void>
    openExternal(url: string): Promise<void>
    copyImage(src: string): Promise<boolean>
    readFile(path: string): Promise<RepoFile | null>
    listFiles(): Promise<string[]>
    writeFile(path: string, text: string): Promise<RepoFile | null>
    locatePath(path: string): Promise<PathLocation>
    previewHtml(id: string, path: string, text: string): Promise<string | null>
    dropPreview(id: string): Promise<void>
    revealFile(path: string): Promise<void>
    setBadge(count: number): Promise<void>
    publishPresence(here: Present[]): void
    onPresence(listener: (snapshot: PresenceSnapshot) => void): () => void
    onTrayTheme(listener: (theme: 'dark' | 'light') => void): () => void
    resizeTray(height: number): void
    openWindow(): void
    closeTray(): void
    setTheme(theme: 'dark' | 'light'): Promise<void>
    notify(alert: AgentAlert): Promise<void>
    openTerminal(id: string, size: { cols: number; rows: number }): void
    writeTerminal(id: string, data: string): void
    resizeTerminal(id: string, size: { cols: number; rows: number }): void
    closeTerminal(id: string): void
    onTerminalData(listener: (id: string, chunk: string) => void): () => void
    onTerminalExit(listener: (id: string) => void): () => void
    onNotificationOpen(listener: (threadId: string) => void): () => void
    applyScribe(settings: ScribeSettings): Promise<ScribeKeyState>
    scribeState(): Promise<ScribeKeyState>
    openScribePermission(): Promise<void>
    scribeWrite(text: string): void
    scribeDone(text: string): void
    dismissScribe(): void
    scribeSaid(): Promise<Said[]>
    forgetScribeSaid(id?: string): Promise<Said[]>
    onScribeSaid(listener: (said: Said[]) => void): () => void
    resizeScribe(width: number, height: number): void
    grabScribe(): void
    moveScribe(x: number, y: number, settled: boolean): void
    onScribe(listener: (word: 'arm' | 'finish' | 'cancel') => void): () => void
    onScribeSettings(listener: (settings: ScribeSettings) => void): () => void
    onScribeProblem(listener: (problem: string | null) => void): () => void
    copyScribeHeld(): void
    letGoScribeHeld(): void
    onScribeHeld(listener: (text: string) => void): () => void
    updateState(): Promise<UpdateState>
    pressUpdate(): Promise<void>
    commandState(): Promise<CommandState>
    installCommand(): Promise<CommandDone>
    removeCommand(): Promise<CommandDone>
    onUpdate(listener: (state: UpdateState) => void): () => void
    onWindowShape(listener: (shape: { square: boolean; full: boolean }) => void): void
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
