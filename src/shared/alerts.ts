export interface AgentAlert {
  title: string
  body: string
  threadId?: string
  // Whose it is, so the app can put a face on the row. A system banner carries
  // the words alone.
  agentId?: string
  from?: string
  // Something went wrong, which is the one thing here that wears the warning
  // mark. A run somebody ended is not one of them: they meant it.
  failed?: boolean
  // Where the way in leads. A question lives on the board and nowhere else, so
  // opening its thread alone would land you on a page that says nothing about it.
  board?: boolean
}

// A window as far as a banner is concerned: which crew it is looking at, and
// whether it is a thread standing on its own.
export interface AlertWindow {
  place: string | null
  popped: boolean
}

// Which window a banner opens in, as an index into the ones there are, or -1 for
// none. It has to land somewhere that can really open the thread it names, and
// the multi window work left two windows that cannot. A window standing on one
// thread is pinned to that one and takes no other, so it is never the answer. A
// window in another project has never heard of this thread, so a window already
// in the crew the banner came from wins over whichever one happens to be first.
export function windowForAlert(windows: AlertWindow[], place: string | null): number {
  const full = windows.map((window, at) => ({ window, at })).filter(one => !one.window.popped)
  const here = place ? full.find(one => one.window.place === place) : undefined
  return (here ?? full[0])?.at ?? -1
}
