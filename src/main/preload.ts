import { contextBridge, ipcRenderer } from 'electron'
import type { AgentAlert } from '../shared/alerts'
import type { PathLocation, RepoFile } from '../shared/files'
import type { MediaAccess, MediaKind, ScreenSource } from '../shared/media'
import type { Present, PresenceSnapshot } from '../shared/presence'
import type { AgentDef, AgentSettings, ProviderCapability } from '../shared/llm'
import type { RepoActionResult, RepoChange, RepoStatus } from '../shared/repository'
import type { CrewHome } from '../shared/project'
import type { RecentJoin, RecentProject } from '../shared/recent'
import type { CurrentSession, OpenOptions } from './session'
import type { TerminalSize } from './terminal'

const bridge = {
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('folder:pick'),
  start: (folder: string, name: string, opts?: OpenOptions): Promise<CurrentSession> =>
    ipcRenderer.invoke('session:start', folder, name, opts),
  join: (link: string, folder: string, name: string): Promise<CurrentSession> =>
    ipcRenderer.invoke('session:join', link, folder, name),
  leave: (): Promise<void> => ipcRenderer.invoke('session:leave'),
  current: (): Promise<CurrentSession | null> => ipcRenderer.invoke('session:current'),
  recentJoins: (): Promise<RecentJoin[]> => ipcRenderer.invoke('session:recent'),
  projects: (): Promise<RecentProject[]> => ipcRenderer.invoke('session:projects'),
  forgetProject: (folder: string): Promise<void> => ipcRenderer.invoke('session:forget', folder),
  forgetJoin: (link: string): Promise<void> => ipcRenderer.invoke('session:forget-join', link),
  projectPlan: (folder: string): Promise<{ home: CrewHome; tracked: boolean; known: boolean }> =>
    ipcRenderer.invoke('session:plan', folder),
  setShared: (shared: boolean): Promise<CurrentSession | null> => ipcRenderer.invoke('session:share', shared),
  agentCapabilities: (): Promise<ProviderCapability[]> => ipcRenderer.invoke('agents:capabilities'),
  installProvider: (provider: string): Promise<ProviderCapability[]> => ipcRenderer.invoke('agents:install', provider),
  createAgent: (input: { provider: string; name: string; settings: AgentSettings }): Promise<AgentDef> =>
    ipcRenderer.invoke('agents:create', input),
  removeAgent: (instanceId: string): Promise<void> => ipcRenderer.invoke('agents:remove', instanceId),
  repoStatus: (): Promise<RepoStatus> => ipcRenderer.invoke('repo:status'),
  repoChanges: (): Promise<RepoChange[]> => ipcRenderer.invoke('repo:changes'),
  pullRepo: (): Promise<RepoActionResult> => ipcRenderer.invoke('repo:pull'),
  pushRepo: (): Promise<RepoActionResult> => ipcRenderer.invoke('repo:push'),
  mediaAccess: (kind: MediaKind): Promise<MediaAccess> => ipcRenderer.invoke('media:access', kind),
  askForMedia: (kind: 'microphone' | 'camera'): Promise<boolean> => ipcRenderer.invoke('media:ask', kind),
  openMediaSettings: (kind: MediaKind): Promise<void> => ipcRenderer.invoke('media:settings', kind),
  screenSources: (): Promise<ScreenSource[]> => ipcRenderer.invoke('media:sources'),
  pickScreenSource: (id: string | null): Promise<void> => ipcRenderer.invoke('media:pickSource', id),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url),
  copyImage: (src: string): Promise<boolean> => ipcRenderer.invoke('clipboard:image', src),
  readFile: (path: string): Promise<RepoFile | null> => ipcRenderer.invoke('file:read', path),
  listFiles: (): Promise<string[]> => ipcRenderer.invoke('file:list'),
  writeFile: (path: string, text: string): Promise<RepoFile | null> =>
    ipcRenderer.invoke('file:write', path, text),
  locatePath: (path: string): Promise<PathLocation> => ipcRenderer.invoke('file:locate', path),
  revealFile: (path: string): Promise<void> => ipcRenderer.invoke('file:reveal', path),
  setBadge: (count: number): Promise<void> => ipcRenderer.invoke('app:badge', count),
  publishPresence: (here: Present[]): void => ipcRenderer.send('presence:publish', here),
  onPresence: (listener: (snapshot: PresenceSnapshot) => void): (() => void) => {
    const handler = (_event: unknown, snapshot: PresenceSnapshot) => listener(snapshot)
    ipcRenderer.on('presence:update', handler)
    return () => {
      ipcRenderer.off('presence:update', handler)
    }
  },
  onTrayTheme: (listener: (theme: 'dark' | 'light') => void): (() => void) => {
    const handler = (_event: unknown, theme: 'dark' | 'light') => listener(theme)
    ipcRenderer.on('tray:theme', handler)
    return () => {
      ipcRenderer.off('tray:theme', handler)
    }
  },
  resizeTray: (height: number): void => ipcRenderer.send('tray:size', height),
  openWindow: (): void => ipcRenderer.send('tray:open'),
  closeTray: (): void => ipcRenderer.send('tray:hide'),
  setTheme: (theme: 'dark' | 'light'): Promise<void> => ipcRenderer.invoke('app:theme', theme),
  notify: (alert: AgentAlert): Promise<void> => ipcRenderer.invoke('app:notify', alert),
  onNotificationOpen: (listener: (threadId: string) => void): (() => void) => {
    const handler = (_event: unknown, threadId: string) => listener(threadId)
    ipcRenderer.on('notification:open', handler)
    return () => {
      ipcRenderer.off('notification:open', handler)
    }
  },
  openTerminal: (id: string, size: TerminalSize): void => ipcRenderer.send('terminal:open', id, size),
  writeTerminal: (id: string, data: string): void => ipcRenderer.send('terminal:write', id, data),
  resizeTerminal: (id: string, size: TerminalSize): void => ipcRenderer.send('terminal:resize', id, size),
  closeTerminal: (id: string): void => ipcRenderer.send('terminal:close', id),
  onTerminalData: (listener: (id: string, chunk: string) => void): (() => void) => {
    const handler = (_event: unknown, id: string, chunk: string) => listener(id, chunk)
    ipcRenderer.on('terminal:data', handler)
    return () => {
      ipcRenderer.off('terminal:data', handler)
    }
  },
  onTerminalExit: (listener: (id: string) => void): (() => void) => {
    const handler = (_event: unknown, id: string) => listener(id)
    ipcRenderer.on('terminal:exit', handler)
    return () => {
      ipcRenderer.off('terminal:exit', handler)
    }
  },
  onWindowShape: (listener: (shape: { square: boolean; full: boolean }) => void): void => {
    ipcRenderer.on('window:shape', (_event, shape: { square: boolean; full: boolean }) =>
      listener(shape)
    )
  },
  onOpenUrl: (listener: (url: string) => void): void => {
    ipcRenderer.on('browser:open', (_event, url: string) => listener(url))
  }
}

export type CrewBridge = typeof bridge

contextBridge.exposeInMainWorld('crew', bridge)
