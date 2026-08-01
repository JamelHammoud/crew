// Where the list stops and the file being read begins. Every desktop client
// draws these two beside each other and never takes the list away, because the
// list is how you get to the next file: VS Code keeps its sidebar while the
// diff is in the editor, and GitHub Desktop puts a 250 wide list next to one.
// Neither of them has a next-file key, and that is why. A panel is 480 across,
// which is narrower than GitHub Desktop's own floor for the pair, so the same
// two panes are stacked rather than laid side by side: the list keeps the width
// it needs for a path and the reading gets the whole of it for a line of code.

const KEY = 'crew.review.split'

// A list worth reading is a heading and a few rows, and a diff worth reading is
// more than a hunk. Under either of those the pane is furniture rather than
// something to work in.
export const LIST_MIN = 92
export const DIFF_MIN = 160

// What the list gets before anybody has said otherwise. A shade over a third
// leaves ten rows up top and the rest of the panel to read in.
export const DEFAULT_SHARE = 0.36

export function clampSplit(want: number, total: number): number {
  if (total <= LIST_MIN + DIFF_MIN) return Math.max(0, Math.round(total / 2))
  return Math.round(Math.min(Math.max(want, LIST_MIN), total - DIFF_MIN))
}

export function defaultSplit(total: number): number {
  return clampSplit(Math.round(total * DEFAULT_SHARE), total)
}

// How tall the list stands is this machine's own, the way the volume is, so it
// is never sent and every window that opens the panel finds it where it was
// left.
export function loadSplit(): number | null {
  const raw = Number(globalThis.localStorage?.getItem(KEY))
  return Number.isFinite(raw) && raw > 0 ? raw : null
}

export function saveSplit(height: number): void {
  try {
    globalThis.localStorage?.setItem(KEY, String(Math.round(height)))
  } catch {
    // A window with no storage keeps it for as long as it is open, which is
    // still better than losing it while it is.
  }
}
