import { contextBridge, ipcRenderer } from 'electron'
import type { AgentDef, AgentSettings, ProviderCapability } from '../shared/llm'

const bridge = {
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('folder:pick'),
  start: (folder: string, name: string): Promise<{ link: string; wsUrl: string }> =>
    ipcRenderer.invoke('session:start', folder, name),
  join: (link: string, folder: string, name: string): Promise<{ wsUrl: string }> =>
    ipcRenderer.invoke('session:join', link, folder, name),
  leave: (): Promise<void> => ipcRenderer.invoke('session:leave'),
  agentCapabilities: (): Promise<ProviderCapability[]> => ipcRenderer.invoke('agents:capabilities'),
  createAgent: (input: { provider: string; name: string; settings: AgentSettings }): Promise<AgentDef> =>
    ipcRenderer.invoke('agents:create', input),
  removeAgent: (instanceId: string): Promise<void> => ipcRenderer.invoke('agents:remove', instanceId),
  onFullScreen: (listener: (full: boolean) => void): void => {
    ipcRenderer.on('window:fullscreen', (_event, full: boolean) => listener(full))
  }
}

export type CrewBridge = typeof bridge

contextBridge.exposeInMainWorld('crew', bridge)
