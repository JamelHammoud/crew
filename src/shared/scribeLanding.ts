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
// The two ways of being wrong do not cost the same, which is what settles every
// rule below. Held words that could have been pasted are on screen, a press away
// from where they were going. Pasted words that had nowhere to go are gone, and
// the only way back is to say the whole thing again, which is the very thing this
// exists to stop. So a doubt is held rather than pasted, and 'unknown', which is
// every machine that will not answer at all, pastes the way it always did.
export type Landing = 'text' | 'none' | 'unknown'

// The caret's own attribute. Everything a person can type in carries it, native
// field and web page alike, and it is what a role cannot say: a contenteditable
// comes back as a group in one app and as a text area in the next, so a list of
// roles to trust is a list that is wrong on the next app somebody opens.
const CARET = 'AXSelectedTextRange'

// What a page says about the thing with the caret in it, which is the one place a
// role cannot be trusted: a box somebody wrote themselves comes back as a group
// in one app and as a text area in the next, and both of them say this instead.
const EDITABLE = 'AXEditableAncestor'

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
  if (attributes.includes(EDITABLE)) return 'text'
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
