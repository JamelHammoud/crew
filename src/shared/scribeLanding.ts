// Where a dictation is about to land. Scribe writes into whatever has the caret,
// so a dictation started with the caret nowhere had nothing to write into and the
// words were lost to a paste that went into the desk. This is what the machine is
// asked before they go out, as a rule rather than as a lookup, so it can be read
// and held to without a keyboard or a screen anywhere near it.
//
// 'text'    something with a caret in it, so the words go where they always went
// 'none'    nothing with a caret, so the words are held where they can be copied
// 'unknown' the machine would not say, which is every machine but a Mac, and
//           every application that has not built the tree to answer with
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

// Anything inside a page says so, and that is what makes the caret's attribute
// unreadable there: a page hands it to a button, to the page itself, to text
// nobody can write in. So inside a page the caret attribute is not asked and
// EDITABLE is the whole answer, which is the one thing only a page can say and
// says it for every box, field and box somebody wrote themselves alike.
//
// A real field is never reached by this, because a field says its own role and is
// answered before any of it is read. What this covers is everything else a page
// can put the focus on, which is most of what is on one.
const PAGE = ['AXDOMClassList', 'AXDOMIdentifier']

// A web area is the page itself, which is what comes back when nothing on it is
// focused, and that is the case this whole feature exists for. Text somebody can
// select is text they cannot write in. Both are named outright so a native
// application that carries neither of the page attributes still answers.
const NOT_TEXT = new Set(['AXWebArea', 'AXStaticText'])

// A field says so outright, so it is taken at its word before anything is read
// off its attributes. This is the belt to the caret's braces rather than the rule
// itself: a text field is somewhere to type whatever else it does or does not say
// about itself.
const TEXT = new Set(['AXTextField', 'AXTextArea', 'AXSearchField', 'AXComboBox', 'AXSecureTextField'])

export function landingFrom(role: string, attributes: readonly string[]): Landing {
  const named = role.trim()
  if (TEXT.has(named)) return 'text'
  if (attributes.includes(EDITABLE)) return 'text'
  if (NOT_TEXT.has(named)) return 'none'
  if (PAGE.some(name => attributes.includes(name))) return 'none'
  return attributes.includes(CARET) ? 'text' : 'none'
}

// Crew's own boxes, which never go through the machine at all. A window here is a
// page, and a page already knows what has the caret in it, so asking macOS about
// our own app is asking another process to describe a box we are holding.
//
// It is also the one app that can be sure. Everything the machine is asked about
// is a Chromium application answering a question it has not built the tree for, so
// our own windows are the one place a 'none' is really earned: the caret is in
// Crew, it is not in anything anybody can type in, and the words are held.
//
// An input nobody here has heard of is somewhere to type. A type is a word from a
// standard that grows, and the ones that are not a box are the ones worth naming:
// read the other way round, the next kind of field to be added anywhere would hold
// somebody's words back from a box they were really in.
const NOT_TYPED_IN = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit'
])

// The two things in one of our own pages that hold a page of their own. The side
// panel is a real browser, so the caret can be in a field on somebody else's site
// while the page around it only ever sees the box that site is drawn in. Read as
// the box, it is not somewhere to type and the words would be held back from a
// field they were really in, so the certainty this file is built on stops here and
// the answer is the doubt it really is.
const HANDS_IT_ON = new Set(['WEBVIEW', 'IFRAME', 'FRAME', 'OBJECT', 'EMBED'])

export function landingInPage(tag: string, type: string, editable: boolean): Landing {
  const named = tag.trim().toUpperCase()
  if (HANDS_IT_ON.has(named)) return 'unknown'
  if (editable) return 'text'
  if (named === 'TEXTAREA') return 'text'
  if (named !== 'INPUT') return 'none'
  return NOT_TYPED_IN.has(type.trim().toLowerCase()) ? 'none' : 'text'
}

// The three things the rule above is asked about, read off the page itself. It is
// a string because it is run in the window rather than here, and it lives beside
// the rule rather than beside the sending so a suite can put a real document
// through the pair of them: what is read and what is made of it are the two halves
// of one answer, and a snippet stranded in main is the half nobody can see.
//
// A shadow root is walked into. The document hands back the host of one rather
// than what is inside it, so a box drawn inside a shadow root would read as the
// element it was drawn in and the words would be held back from a real field.
//
// Editable is asked twice, and it has to be. The property carries the answer down
// from wherever it was written, which is the whole of what makes a doc's own box
// answer for the elements inside it, and the attribute is what a box that says so
// itself carries. Either one is enough, and a box that says outright it is not one
// is not one however it was reached.
export const FOCUSED_IN_PAGE = `(() => {
  let el = document.activeElement
  while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement
  if (!el) return null
  const said = el.getAttribute ? el.getAttribute('contenteditable') : null
  return {
    tag: el.tagName || '',
    type: el.getAttribute ? el.getAttribute('type') || '' : '',
    editable: said === 'false' ? false : !!el.isContentEditable || said !== null
  }
})()`

// Whether what was said is held back rather than written out. Copying was already
// the answer to wanting the words on the clipboard, so a dictation aimed there is
// never held: it has somewhere to go and it goes there. Everything else turns on
// the one answer that had to be earned.
export const holdsBack = (finish: 'paste' | 'copy', aim: Landing): boolean => finish === 'paste' && aim === 'none'

// Stretches of one dictation, joined into the thing somebody said. They already
// carry the space that keeps them off the end of the one before them, so nothing
// goes between them, and only the first is trimmed: a card that opened on a space
// would read as a card holding nothing for as long as it took the first word to
// be read.
export const joinHeld = (held: string, text: string): string => (held ? held + text : text.trimStart())

// What the machine printed, which is one line for the role and one for the
// attributes it holds. A shape this does not recognise is 'unknown' rather than a
// guess: the answer comes off another process and every part of it has to be
// there before any of it is worth acting on.
//
// The bare word 'none' is an application with nothing open, and it is the whole of
// what the machine may say without naming a role. An application with a window but
// no focused element to hand over says 'unknown' instead, because that is a
// Chromium one that has not built its accessibility tree rather than one saying
// nothing has the caret, and Crew, Discord, VS Code and Chrome all say it whether
// or not somebody is typing. Read as an answer it held the words back from every
// box anybody really dictates into while catching nothing at all, which is what
// "click into a text box" over an open composer was.
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
