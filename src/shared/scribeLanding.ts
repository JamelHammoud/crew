// Where a dictation is about to land. Scribe writes into whatever has the caret,
// so a dictation started with the caret nowhere had nothing to write into and the
// words were lost to a paste that went into the desk. This is what the machine is
// asked before they go out, as a rule rather than as a lookup, so it can be read
// and held to without a keyboard or a screen anywhere near it.
//
// 'text'    something with a caret in it, so the words go where they always went
// 'none'    nothing with a caret, so the words are held where they can be copied
// 'unknown' the machine would not say, which is every machine but a Mac
//
// Only 'none' changes what happens, and it is the one answer that has to be
// earned. A dictation that is held when it could have been written is worse than
// one written into nothing, because the second costs a paste and the first costs
// the habit: the words are on screen behind a button rather than in the sentence
// somebody was in the middle of. So anything this cannot account for is 'unknown'
// and pastes the way it always did.
export type Landing = 'text' | 'none' | 'unknown'

// The caret's own attribute. Everything a person can type in carries it, native
// field and web page alike, and it is what a role cannot say: a contenteditable
// comes back as a group in one app and as a text area in the next, so a list of
// roles to trust is a list that is wrong on the next app somebody opens.
const CARET = 'AXSelectedTextRange'

// Two things carry the caret's attribute and are not somewhere to type. A web
// area is the page itself, which is what a browser hands back when nothing on the
// page is focused, and that is the whole case this feature exists for. Text
// somebody can select is text they cannot write in.
const NOT_TEXT = new Set(['AXWebArea', 'AXStaticText'])

// A field says so outright, so it is taken at its word before anything is read
// off its attributes. This is the belt to the caret's braces rather than the rule
// itself: a text field is somewhere to type whatever else it does or does not say
// about itself.
const TEXT = new Set([
  'AXTextField',
  'AXTextArea',
  'AXSearchField',
  'AXComboBox',
  'AXSecureTextField'
])

export function landingFrom(role: string, attributes: readonly string[]): Landing {
  const named = role.trim()
  if (TEXT.has(named)) return 'text'
  if (NOT_TEXT.has(named)) return 'none'
  return attributes.includes(CARET) ? 'text' : 'none'
}

// What the machine printed, which is one line for the role and one for the
// attributes it holds. A shape this does not recognise is 'unknown' rather than a
// guess: the answer comes off another process and every part of it has to be
// there before any of it is worth acting on.
export function landingOf(printed: string): Landing {
  const lines = printed.trim().split('\n')
  if (lines[0]?.trim() === 'none') return 'none'
  if (lines.length < 2) return 'unknown'
  const role = lines[0].trim()
  if (!role || role === 'unknown') return 'unknown'
  return landingFrom(
    role,
    lines[1]
      .split(',')
      .map(name => name.trim())
      .filter(Boolean)
  )
}
