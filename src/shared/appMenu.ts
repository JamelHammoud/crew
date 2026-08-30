import type { ThreadStatus } from './events'

export type AppMenuAction =
  | 'settings'
  | 'about'
  | 'check-updates'
  | 'invite'
  | 'copy-invite-link'
  | 'people'
  | 'agents'
  | 'new-thread'
  | 'new-page'
  | 'new-board'
  | 'new-sticky'
  | 'open-crew'
  | 'join-crew'
  | 'reveal-crew'
  | 'find'
  | 'find-next'
  | 'find-previous'
  | 'find-in-files'
  | 'command-palette'
  | 'toggle-sidebar'
  | 'toggle-panel'
  | 'panel-review'
  | 'panel-terminal'
  | 'panel-files'
  | 'panel-web'
  | 'panel-music'
  | 'panel-games'
  | 'go-back'
  | 'go-forward'
  | 'go-chat'
  | 'go-docs'
  | 'go-design'
  | 'go-plugins'
  | 'go-scheduled'
  | 'go-stickies'
  | 'go-browser'
  | 'go-mail'
  | 'thread-window'
  | 'thread-status'
  | 'thread-archive'
  | 'thread-copy-id'
  | 'window-pin'

export interface AppMenuContext {
  session: boolean
  threadId: string | null
  threadStatus: ThreadStatus | null
  sidebar: boolean
  panel: boolean
  pinned: boolean
}

export const EMPTY_APP_MENU_CONTEXT: AppMenuContext = {
  session: false,
  threadId: null,
  threadStatus: null,
  sidebar: false,
  panel: false,
  pinned: false
}
