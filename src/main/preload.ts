import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { AgentAlert } from '../shared/alerts'
import type { AppIconId } from '../shared/appIcon'
import type { BrowserTab } from '../shared/browserTab'
import type { SystemDetails } from '../shared/feedback'
import type { OpenRequest } from '../shared/cli'
import type { CommandDone, CommandState } from '../shared/crewCommand'
import type {
  FileContentSearch,
  FileCopyPaths,
  PathLocation,
  RepoEntryCreateResult,
  RepoEntryImportResult,
  RepoEntryKind,
  RepoEntryMoveResult,
  RepoEntryTransferMode,
  RepoEntryTransferResult,
  RepoFile
} from '../shared/files'
import type { FileReplaceRequest, FileReplaceResult, FileSearchOptions } from '../shared/fileSearch'
import type { MachineDir } from '../shared/machinePath'
import {
  MAIL_IPC,
  MAIL_RENDERER_EVENTS,
  type MailBridge,
  type MailConnectionEvent,
  type MailNotification,
  type MailUnreadEvent
} from '../shared/mail'
import type { MediaAccess, MediaKind, ScreenSource } from '../shared/media'
import type { ModelServer } from '../shared/modelServers'
import type { PluginConnectionInput, PluginConnectionResult } from '../shared/plugins'
import type { LivePlace } from '../shared/places'
import type { Present, PresenceSnapshot } from '../shared/presence'
import type { AgentDef, AgentSettings, ProviderCapability } from '../shared/llm'
import type { RepoActionResult, RepoChange, RepoCommand, RepoStatus, RepoWork } from '../shared/repository'
import type { RecentJoin, RecentProject } from '../shared/recent'
import type { ScribeKeyState, ScribeSettings } from '../shared/scribe'
import type { Said } from '../shared/scribeSaid'
import type { CreateStickyInput, Sticky, UpdateStickyInput } from '../shared/stickies'
import type { UpdateState } from '../shared/update'
import type { CurrentSession, OpenOptions, ProjectPlan } from './session'
import type { TerminalSize } from './terminal'

const mailBridge: MailBridge = {
  listAccounts: () => ipcRenderer.invoke(MAIL_IPC.listAccounts),
  connectAccount: input => ipcRenderer.invoke(MAIL_IPC.connectAccount, input),
  removeAccount: accountId => ipcRenderer.invoke(MAIL_IPC.removeAccount, accountId),
  reconnectAccount: (accountId, appPassword) => ipcRenderer.invoke(MAIL_IPC.reconnectAccount, accountId, appPassword),
  updateAccount: (accountId, patch) => ipcRenderer.invoke(MAIL_IPC.updateAccount, accountId, patch),
  listThreads: query => ipcRenderer.invoke(MAIL_IPC.listThreads, query),
  getThread: (accountId, threadId) => ipcRenderer.invoke(MAIL_IPC.getThread, accountId, threadId),
  sync: accountId => ipcRenderer.invoke(MAIL_IPC.sync, accountId),
  setThreadState: (accountId, threadIds, patch) =>
    ipcRenderer.invoke(MAIL_IPC.setThreadState, accountId, threadIds, patch),
  saveDraft: draft => ipcRenderer.invoke(MAIL_IPC.saveDraft, draft),
  discardDraft: (accountId, draftId) => ipcRenderer.invoke(MAIL_IPC.discardDraft, accountId, draftId),
  sendDraft: (draft, sendAt) => ipcRenderer.invoke(MAIL_IPC.sendDraft, draft, sendAt),
  addAttachment: async (accountId, draftId, file) =>
    ipcRenderer.invoke(MAIL_IPC.addAttachment, accountId, draftId, {
      name: file.name,
      mime: file.type,
      bytes: new Uint8Array(await file.arrayBuffer())
    }),
  saveAttachment: (accountId, messageId, attachmentId) =>
    ipcRenderer.invoke(MAIL_IPC.saveAttachment, accountId, messageId, attachmentId),
  printThread: (accountId, threadId) => ipcRenderer.invoke(MAIL_IPC.printThread, accountId, threadId),
  snoozeThread: (accountId, threadId, wakeAt) =>
    ipcRenderer.invoke(MAIL_IPC.snoozeThread, accountId, threadId, wakeAt),
  onChanged: listener => {
    const handler = (): void => listener()
    ipcRenderer.on(MAIL_RENDERER_EVENTS.changed, handler)
    return () => ipcRenderer.off(MAIL_RENDERER_EVENTS.changed, handler)
  },
  onOnline: listener => {
    const handler = (_event: unknown, online: boolean): void => listener(online)
    ipcRenderer.on(MAIL_RENDERER_EVENTS.online, handler)
    return () => ipcRenderer.off(MAIL_RENDERER_EVENTS.online, handler)
  },
  onConnection: listener => {
    const handler = (_event: unknown, value: MailConnectionEvent): void => listener(value)
    ipcRenderer.on(MAIL_RENDERER_EVENTS.connection, handler)
    return () => ipcRenderer.off(MAIL_RENDERER_EVENTS.connection, handler)
  },
  onUnread: listener => {
    const handler = (_event: unknown, value: MailUnreadEvent): void => listener(value)
    ipcRenderer.on(MAIL_RENDERER_EVENTS.unread, handler)
    return () => ipcRenderer.off(MAIL_RENDERER_EVENTS.unread, handler)
  },
  onNotification: listener => {
    const handler = (_event: unknown, notification: MailNotification): void => listener(notification)
    ipcRenderer.on(MAIL_RENDERER_EVENTS.notification, handler)
    return () => ipcRenderer.off(MAIL_RENDERER_EVENTS.notification, handler)
  }
}

const bridge = {
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('folder:pick'),
  cloneRepo: (remote: string): Promise<string | null> => ipcRenderer.invoke('repo:clone', remote),
  start: (folder: string, name: string, opts?: OpenOptions): Promise<CurrentSession> =>
    ipcRenderer.invoke('session:start', folder, name, opts),
  join: (link: string, folder: string, name: string): Promise<CurrentSession> =>
    ipcRenderer.invoke('session:join', link, folder, name),
  leave: (): Promise<void> => ipcRenderer.invoke('session:leave'),
  current: (): Promise<CurrentSession | null> => ipcRenderer.invoke('session:current'),
  rename: (name: string): Promise<CurrentSession | null> => ipcRenderer.invoke('session:rename', name),
  switchTo: (key: string): Promise<CurrentSession | null> => ipcRenderer.invoke('session:switch', key),
  closeProject: (key: string): Promise<void> => ipcRenderer.invoke('session:close', key),
  liveProjects: (): Promise<LivePlace[]> => ipcRenderer.invoke('session:live'),
  onLive: (listener: (places: LivePlace[]) => void): (() => void) => {
    const handler = (_event: unknown, places: LivePlace[]) => listener(places)
    ipcRenderer.on('session:live', handler)
    return () => {
      ipcRenderer.off('session:live', handler)
    }
  },
  recentJoins: (): Promise<RecentJoin[]> => ipcRenderer.invoke('session:recent'),
  projects: (): Promise<RecentProject[]> => ipcRenderer.invoke('session:projects'),
  forgetProject: (folder: string): Promise<void> => ipcRenderer.invoke('session:forget', folder),
  forgetJoin: (link: string): Promise<void> => ipcRenderer.invoke('session:forget-join', link),
  opening: (): Promise<OpenRequest | null> => ipcRenderer.invoke('cli:opening'),
  projectPlan: (folder: string): Promise<ProjectPlan> => ipcRenderer.invoke('session:plan', folder),
  connectCrew: (remote: string): Promise<{ ok: boolean; message: string }> =>
    ipcRenderer.invoke('crew:connect', remote),
  setProjectSync: (on: boolean): Promise<CurrentSession | null> => ipcRenderer.invoke('session:sync', on),
  setShared: (shared: boolean): Promise<CurrentSession | null> => ipcRenderer.invoke('session:share', shared),
  agentCapabilities: (): Promise<ProviderCapability[]> => ipcRenderer.invoke('agents:capabilities'),
  installProvider: (provider: string): Promise<ProviderCapability[]> => ipcRenderer.invoke('agents:install', provider),
  modelServers: (): Promise<ModelServer[]> => ipcRenderer.invoke('agents:servers'),
  addModelServer: (input: { url: string; name?: string; key?: string }): Promise<ProviderCapability[]> =>
    ipcRenderer.invoke('agents:addServer', input),
  forgetModelServer: (url: string): Promise<ProviderCapability[]> => ipcRenderer.invoke('agents:forgetServer', url),
  createAgent: (input: { provider: string; name: string; settings: AgentSettings }): Promise<AgentDef> =>
    ipcRenderer.invoke('agents:create', input),
  removeAgent: (instanceId: string): Promise<void> => ipcRenderer.invoke('agents:remove', instanceId),
  repoStatus: (): Promise<RepoStatus> => ipcRenderer.invoke('repo:status'),
  repoChanges: (): Promise<RepoChange[]> => ipcRenderer.invoke('repo:changes'),
  pullRepo: (): Promise<RepoActionResult> => ipcRenderer.invoke('repo:pull'),
  pushRepo: (): Promise<RepoActionResult> => ipcRenderer.invoke('repo:push'),
  repoWork: (): Promise<RepoWork> => ipcRenderer.invoke('repo:work'),
  runRepo: (command: RepoCommand): Promise<RepoActionResult> => ipcRenderer.invoke('repo:run', command),
  mediaAccess: (kind: MediaKind): Promise<MediaAccess> => ipcRenderer.invoke('media:access', kind),
  askForMedia: (kind: 'microphone' | 'camera'): Promise<boolean> => ipcRenderer.invoke('media:ask', kind),
  openMediaSettings: (kind: MediaKind): Promise<void> => ipcRenderer.invoke('media:settings', kind),
  screenSources: (): Promise<ScreenSource[]> => ipcRenderer.invoke('media:sources'),
  pickScreenSource: (id: string | null): Promise<void> => ipcRenderer.invoke('media:pickSource', id),
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke('shell:openExternal', url),
  connectPlugin: (plugin: PluginConnectionInput): Promise<PluginConnectionResult> =>
    ipcRenderer.invoke('plugins:connect', plugin),
  pluginStatus: (plugin: PluginConnectionInput): Promise<boolean> => ipcRenderer.invoke('plugins:status', plugin),
  disconnectPlugin: (plugin: PluginConnectionInput): Promise<void> => ipcRenderer.invoke('plugins:disconnect', plugin),
  copyImage: (src: string): Promise<boolean> => ipcRenderer.invoke('clipboard:image', src),
  readFile: (path: string): Promise<RepoFile | null> => ipcRenderer.invoke('file:read', path),
  listFiles: (): Promise<string[]> => ipcRenderer.invoke('file:list'),
  createEntry: (path: string, kind: RepoEntryKind): Promise<RepoEntryCreateResult> =>
    ipcRenderer.invoke('file:create', path, kind),
  moveEntry: (source: string, parent: string): Promise<RepoEntryMoveResult> =>
    ipcRenderer.invoke('file:move', source, parent),
  transferEntries: (
    sources: string[],
    parent: string,
    mode: RepoEntryTransferMode
  ): Promise<RepoEntryTransferResult> => ipcRenderer.invoke('file:transfer', sources, parent, mode),
  filePath: (file: File): string => webUtils.getPathForFile(file),
  importEntries: (sources: string[], parent: string): Promise<RepoEntryImportResult> =>
    ipcRenderer.invoke('file:import', sources, parent),
  searchFiles: (options: FileSearchOptions): Promise<FileContentSearch> => ipcRenderer.invoke('file:search', options),
  replaceFiles: (request: FileReplaceRequest): Promise<FileReplaceResult> =>
    ipcRenderer.invoke('file:replace', request),
  readDirs: (query: string): Promise<MachineDir[]> => ipcRenderer.invoke('file:dirs', query),
  writeFile: (path: string, text: string): Promise<RepoFile | null> => ipcRenderer.invoke('file:write', path, text),
  locatePath: (path: string): Promise<PathLocation> => ipcRenderer.invoke('file:locate', path),
  copyPaths: (path: string): Promise<FileCopyPaths> => ipcRenderer.invoke('file:copyPaths', path),
  previewHtml: (id: string, path: string, text: string | null): Promise<string | null> =>
    ipcRenderer.invoke('preview:html', id, path, text),
  dropPreview: (id: string): Promise<void> => ipcRenderer.invoke('preview:drop', id),
  revealFile: (path: string): Promise<boolean> => ipcRenderer.invoke('file:reveal', path),
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
  openChat: (): void => ipcRenderer.send('tray:chat'),
  openProjectWindow: (key: string): Promise<boolean> => ipcRenderer.invoke('window:open-project', key),
  openPersonalChat: (name: string): Promise<boolean> => ipcRenderer.invoke('window:open-personal', name),
  openStickies: (): Promise<boolean> => ipcRenderer.invoke('window:open-stickies'),
  openSticky: (id: string): Promise<boolean> => ipcRenderer.invoke('window:open-sticky', id),
  listStickies: (): Promise<Sticky[]> => ipcRenderer.invoke('stickies:list'),
  createSticky: (input: CreateStickyInput): Promise<Sticky> => ipcRenderer.invoke('stickies:create', input),
  updateSticky: (id: string, patch: UpdateStickyInput): Promise<Sticky | null> =>
    ipcRenderer.invoke('stickies:update', id, patch),
  deleteSticky: (id: string): Promise<boolean> => ipcRenderer.invoke('stickies:delete', id),
  onStickiesChanged: (listener: (stickies: Sticky[]) => void): (() => void) => {
    const handler = (_event: unknown, stickies: Sticky[]) => listener(stickies)
    ipcRenderer.on('stickies:changed', handler)
    return () => {
      ipcRenderer.off('stickies:changed', handler)
    }
  },
  closeTray: (): void => ipcRenderer.send('tray:hide'),
  popOutThread: (threadId: string, key?: string): Promise<void> =>
    ipcRenderer.invoke('window:pop-thread', threadId, key),
  popOutBrowserTab: (tab: BrowserTab): Promise<boolean> => ipcRenderer.invoke('window:pop-browser-tab', tab),
  beginBrowserTabDrag: (token: string, tab: BrowserTab): boolean =>
    ipcRenderer.sendSync('browser:drag-tab', token, tab) === true,
  beginFileTabDrag: (token: string, tab: BrowserTab): boolean =>
    ipcRenderer.sendSync('browser:drag-file-tab', token, tab) === true,
  dropBrowserTab: (token: string, to: number): Promise<boolean> => ipcRenderer.invoke('browser:drop-tab', token, to),
  closeBrowserWindow: (): void => ipcRenderer.send('window:close-browser'),
  setWindowPinned: (pinned: boolean): Promise<boolean> => ipcRenderer.invoke('window:pin', pinned),
  appVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  systemInfo: (): Promise<SystemDetails> => ipcRenderer.invoke('app:system'),
  setTheme: (theme: 'dark' | 'light'): Promise<void> => ipcRenderer.invoke('app:theme', theme),
  setAppIcon: (icon: AppIconId): Promise<void> => ipcRenderer.invoke('app:icon', icon),
  keepAwake: (on: boolean): void => ipcRenderer.send('app:awake', on),
  notify: (alert: AgentAlert): Promise<void> => ipcRenderer.invoke('app:notify', alert),
  onNotificationOpen: (listener: (threadId: string, place: string | null) => void): (() => void) => {
    const handler = (_event: unknown, threadId: string, place: string | null) => listener(threadId, place)
    ipcRenderer.on('notification:open', handler)
    return () => {
      ipcRenderer.off('notification:open', handler)
    }
  },
  onChatOpen: (listener: () => void): (() => void) => {
    const handler = () => listener()
    ipcRenderer.on('chat:open', handler)
    return () => {
      ipcRenderer.off('chat:open', handler)
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
  onTerminalRunning: (listener: (id: string, command: string) => void): (() => void) => {
    const handler = (_event: unknown, id: string, command: string) => listener(id, command)
    ipcRenderer.on('terminal:running', handler)
    return () => {
      ipcRenderer.off('terminal:running', handler)
    }
  },
  onTerminalExit: (listener: (id: string) => void): (() => void) => {
    const handler = (_event: unknown, id: string) => listener(id)
    ipcRenderer.on('terminal:exit', handler)
    return () => {
      ipcRenderer.off('terminal:exit', handler)
    }
  },
  applyScribe: (settings: ScribeSettings): Promise<ScribeKeyState> => ipcRenderer.invoke('scribe:apply', settings),
  scribeState: (): Promise<ScribeKeyState> => ipcRenderer.invoke('scribe:state'),
  openScribePermission: (): Promise<void> => ipcRenderer.invoke('scribe:permission'),
  scribeWrite: (text: string): void => ipcRenderer.send('scribe:write', text),
  scribeDone: (text: string): void => ipcRenderer.send('scribe:done', text),
  dismissScribe: (): void => ipcRenderer.send('scribe:dismiss'),
  scribeSaid: (): Promise<Said[]> => ipcRenderer.invoke('scribe:said'),
  forgetScribeSaid: (id?: string): Promise<Said[]> => ipcRenderer.invoke('scribe:forget', id),
  onScribeSaid: (listener: (said: Said[]) => void): (() => void) => {
    const handler = (_event: unknown, list: Said[]) => listener(list)
    ipcRenderer.on('scribe:said', handler)
    return () => {
      ipcRenderer.off('scribe:said', handler)
    }
  },
  resizeScribe: (width: number, height: number): void => ipcRenderer.send('scribe:size', width, height),
  grabScribe: (): void => ipcRenderer.send('scribe:grab'),
  moveScribe: (x: number, y: number, settled: boolean): void => ipcRenderer.send('scribe:drag', x, y, settled),
  onScribe: (listener: (word: 'arm' | 'finish' | 'cancel') => void): (() => void) => {
    const arm = () => listener('arm')
    const finish = () => listener('finish')
    const cancel = () => listener('cancel')
    ipcRenderer.on('scribe:arm', arm)
    ipcRenderer.on('scribe:finish', finish)
    ipcRenderer.on('scribe:cancel', cancel)
    return () => {
      ipcRenderer.off('scribe:arm', arm)
      ipcRenderer.off('scribe:finish', finish)
      ipcRenderer.off('scribe:cancel', cancel)
    }
  },
  onScribeSettings: (listener: (settings: ScribeSettings) => void): (() => void) => {
    const handler = (_event: unknown, settings: ScribeSettings) => listener(settings)
    ipcRenderer.on('scribe:settings', handler)
    return () => {
      ipcRenderer.off('scribe:settings', handler)
    }
  },
  onScribeProblem: (listener: (problem: string | null) => void): (() => void) => {
    const handler = (_event: unknown, problem: string | null) => listener(problem)
    ipcRenderer.on('scribe:problem', handler)
    return () => {
      ipcRenderer.off('scribe:problem', handler)
    }
  },
  // Words a dictation found nothing to write into. Main holds them and says so,
  // and Copy is answered there for the same reason: this window never takes
  // focus, and the clipboard is not something a page without it can reach.
  copyScribeHeld: (): void => ipcRenderer.send('scribe:copyHeld'),
  letGoScribeHeld: (): void => ipcRenderer.send('scribe:letGo'),
  onScribeHeld: (listener: (text: string) => void): (() => void) => {
    const handler = (_event: unknown, text: string) => listener(text)
    ipcRenderer.on('scribe:held', handler)
    return () => {
      ipcRenderer.off('scribe:held', handler)
    }
  },
  updateState: (): Promise<UpdateState> => ipcRenderer.invoke('update:state'),
  pressUpdate: (): Promise<void> => ipcRenderer.invoke('update:press'),
  commandState: (): Promise<CommandState> => ipcRenderer.invoke('command:state'),
  installCommand: (): Promise<CommandDone> => ipcRenderer.invoke('command:install'),
  removeCommand: (): Promise<CommandDone> => ipcRenderer.invoke('command:remove'),
  onUpdate: (listener: (state: UpdateState) => void): (() => void) => {
    const handler = (_event: unknown, state: UpdateState) => listener(state)
    ipcRenderer.on('update:state', handler)
    return () => {
      ipcRenderer.off('update:state', handler)
    }
  },
  onWindowShape: (listener: (shape: { square: boolean; full: boolean; pinned: boolean }) => void): void => {
    ipcRenderer.on('window:shape', (_event, shape: { square: boolean; full: boolean; pinned: boolean }) =>
      listener(shape)
    )
  },
  onOpenUrl: (listener: (url: string) => void): void => {
    ipcRenderer.on('browser:open', (_event, url: string) => listener(url))
  },
  onOpenBrowserTab: (listener: (tab: BrowserTab) => void): void => {
    ipcRenderer.on('browser:open-tab', (_event, tab: BrowserTab) => listener(tab))
  },
  onInsertBrowserTab: (listener: (tab: BrowserTab, to: number) => void): void => {
    ipcRenderer.on('browser:insert-tab', (_event, tab: BrowserTab, to: number) => listener(tab, to))
  },
  onRemoveBrowserTab: (listener: (id: string) => void): void => {
    ipcRenderer.on('browser:remove-tab', (_event, id: string) => listener(id))
  },
  onMoveBrowserTab: (listener: (id: string, to: number) => void): void => {
    ipcRenderer.on('browser:move-tab', (_event, id: string, to: number) => listener(id, to))
  },
  onFindInPage: (listener: () => void): (() => void) => {
    const handler = () => listener()
    ipcRenderer.on('browser:find', handler)
    return () => {
      ipcRenderer.off('browser:find', handler)
    }
  },
  registerBrowserView: (id: number): void => ipcRenderer.send('browser:view', id),
  onCrewTrouble: (listener: (message: string) => void): (() => void) => {
    const handler = (_event: unknown, message: string): void => listener(message)
    ipcRenderer.on('crew:trouble', handler)
    return () => {
      ipcRenderer.removeListener('crew:trouble', handler)
    }
  }
}

export type CrewBridge = typeof bridge

contextBridge.exposeInMainWorld('crew', bridge)
contextBridge.exposeInMainWorld('mail', mailBridge)
