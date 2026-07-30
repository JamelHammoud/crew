// The last few dictations, kept so one can be copied again after it has already
// landed somewhere. It stays on the machine it was spoken on, the way the rest
// of Scribe does: nothing here is written to the log, nothing is sent, and the
// crew never sees a word of it.

export interface Said {
  id: string
  text: string
  at: number
}

// A short page rather than a record. Anything further back than this is a
// dictation nobody is coming back for, and every one of them is sitting on
// somebody's disk in plain words.
export const SAID_LIMIT = 5

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

// What arrives is only ever as good as what checks it. This comes back off a
// file written by an older build, or by hand, so nothing is taken on trust: a
// row missing any of the three is dropped rather than carried as half a row,
// and an id that names two of them names neither, since the id is the whole of
// how one is copied or taken away.
//
// It sorts rather than trusting the order it is handed. Newest first is what
// the page is read in, and a file that was written by something else has no
// reason to have kept it, so the cap falls on the oldest here rather than on
// whatever happened to be at the end.
export function cleanSaid(input: unknown): Said[] {
  if (!Array.isArray(input)) return []
  const out: Said[] = []
  const seen = new Set<string>()
  for (const row of input) {
    if (!row || typeof row !== 'object') continue
    const held = row as Partial<Said>
    const id = text(held.id)
    const said = text(held.text)
    if (!id || !said || !Number.isFinite(held.at) || seen.has(id)) continue
    seen.add(id)
    out.push({ id, text: said, at: held.at as number })
  }
  return out.sort((a, b) => b.at - a.at).slice(0, SAID_LIMIT)
}
