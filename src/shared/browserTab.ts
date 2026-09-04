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
    | 'ios'
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
  // What is running in a terminal right now, and the last thing that did. A
  // shell standing at its prompt is still the terminal somebody opened to run
  // something, so what it ran is what it goes on being called.
  running: string
  ran: string[]
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
