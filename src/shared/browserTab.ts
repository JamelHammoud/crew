export type BrowserTab = {
  id: string
  kind:
    | 'web'
    | 'file'
    | 'terminal'
    | 'image'
    | 'attachment'
    | 'music'
    | 'game'
    | 'plan'
    | 'work'
    | 'aside'
    | 'agent'
    | 'review'
  initialUrl: string
  url: string
  title: string
  favicon: string | null
  loading: boolean
  error: string
  canGoBack: boolean
  canGoForward: boolean
  path: string
  line: number | null
  diff: string | null
  command: string | null
  folder: string
  mime: string
  size: number
  game: string | null
  threadId: string
  parentThreadId: string
  back: string[]
  forward: string[]
  tree: boolean
  open: string[]
  preview: boolean
  pinned: boolean
  generation: number
  plugin: string | null
  pluginLabel: string
}
