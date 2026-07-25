import { contextBridge, ipcRenderer } from 'electron'
import type { PathLocation, RepoFile } from '../shared/files'
import type { MediaAccess, MediaKind, ScreenSource } from './media'
import type { AgentDef, AgentSettings, ProviderCapability } from '../shared/llm'
import type { RepoActionResult, RepoChange, RepoStatus } from '../shared/repository'
import type { RecentJoin } from '../shared/recent'
import type { CurrentSession } from './session'

const bridge = {
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('folder:pick'),
  start: (folder: string, name: string): Promise<{ link: string; wsUrl: string }> =>
    ipcRenderer.invoke('session:start', folder, name),
  join: (link: string, folder: string, name: string): Promise<{ wsUrl: string }> =>
    ipcRenderer.invoke('session:join', link, folder, name),
  leave: (): Promise<void> => ipcRenderer.invoke('session:leave'),
  current: (): Promise<CurrentSession | null> => ipcRenderer.invoke('session:current'),
  recentJoins: (): Promise<RecentJoin[]> => ipcRenderer.invoke('session:recent'),
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
  readFile: (path: string): Promise<RepoFile | null> => ipcRenderer.invoke('file:read', path),
  writeFile: (path: string, text: string): Promise<RepoFile | null> =>
    ipcRenderer.invoke('file:write', path, text),
  locatePath: (path: string): Promise<PathLocation> => ipcRenderer.invoke('file:locate', path),
  revealFile: (path: string): Promise<void> => ipcRenderer.invoke('file:reveal', path),
  onFullScreen: (listener: (full: boolean) => void): void => {
    ipcRenderer.on('window:fullscreen', (_event, full: boolean) => listener(full))
  },
  onOpenUrl: (listener: (url: string) => void): void => {
    ipcRenderer.on('browser:open', (_event, url: string) => listener(url))
  }
}

export type CrewBridge = typeof bridge

contextBridge.exposeInMainWorld('crew', bridge)
