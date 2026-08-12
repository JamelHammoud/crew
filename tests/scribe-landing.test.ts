import { describe, expect, it } from 'vitest'
import { landingFrom, landingInPage, landingOf } from '../src/shared/scribeLanding'

// Where a dictation lands. None of this touches a keyboard or a machine, which is
// the whole point of the answer being a rule: the roles and the attribute lists
// here are the ones real applications really hand back, and the only thing that
// changes what happens is 'none'.
//
// So every case is read twice: once for the answer it gives, and once for the
// thing that costs somebody their words, which is a 'none' that was never earned.

const FIELD = [
  'AXRole',
  'AXRoleDescription',
  'AXValue',
  'AXNumberOfCharacters',
  'AXSelectedText',
  'AXSelectedTextRange',
  'AXVisibleCharacterRange',
  'AXInsertionPointLineNumber',
  'AXEnabled',
  'AXFocused',
  'AXParent',
  'AXWindow',
  'AXTopLevelUIElement',
  'AXPosition',
  'AXSize'
]

const WRITTEN_BOX = [
  'AXRole',
  'AXRoleDescription',
  'AXParent',
  'AXChildren',
  'AXWindow',
  'AXTopLevelUIElement',
  'AXPosition',
  'AXSize',
  'AXFocused',
  'AXValue',
  'AXSelectedText',
  'AXSelectedTextRange',
  'AXEditableAncestor',
  'AXHighestEditableAncestor',
  'AXFocusableAncestor'
]

const PAGE = [
  'AXRole',
  'AXRoleDescription',
  'AXParent',
  'AXChildren',
  'AXWindow',
  'AXTopLevelUIElement',
  'AXPosition',
  'AXSize',
  'AXEnabled',
  'AXFocused',
  'AXURL',
  'AXSelectedTextRange',
  'AXSelectedTextMarkerRange',
  'AXCaretBrowsingEnabled'
]

const LABEL = [
  'AXRole',
  'AXRoleDescription',
  'AXValue',
  'AXParent',
  'AXWindow',
  'AXTopLevelUIElement',
  'AXPosition',
  'AXSize',
  'AXEnabled',
  'AXNumberOfCharacters',
  'AXVisibleCharacterRange',
  'AXSelectedTextRange'
]

const ROW = [
  'AXRole',
  'AXRoleDescription',
  'AXParent',
  'AXChildren',
  'AXWindow',
  'AXTopLevelUIElement',
  'AXPosition',
  'AXSize',
  'AXEnabled',
  'AXSelected',
  'AXIndex',
  'AXDisclosing',
  'AXDisclosureLevel'
]

describe('what has the caret in it', () => {
  it('writes into a native field', () => {
    expect(landingFrom('AXTextField', FIELD)).toBe('text')
  })

  it('writes into a text area', () => {
    expect(landingFrom('AXTextArea', FIELD)).toBe('text')
  })

  it('writes into a search field, a combo box and a password field', () => {
    expect(landingFrom('AXSearchField', FIELD)).toBe('text')
    expect(landingFrom('AXComboBox', FIELD)).toBe('text')
    expect(landingFrom('AXSecureTextField', FIELD)).toBe('text')
  })

  // A box somebody wrote themselves comes back as a group in one app and as a
  // text area in the next, so the role is no answer and the page says it instead.
  it('writes into a box that comes back as a group and says it is editable', () => {
    expect(landingFrom('AXGroup', WRITTEN_BOX)).toBe('text')
  })

  it('writes into an editable box whatever role it claims', () => {
    expect(landingFrom('AXUnknown', WRITTEN_BOX)).toBe('text')
    expect(landingFrom('AXStaticText', WRITTEN_BOX)).toBe('text')
  })

  // The whole case the feature exists for. A browser with nothing on the page
  // focused hands back the page itself, and the page carries the caret's own
  // attribute, so the attribute alone would paste into nothing.
  it('holds the words back on a page with nothing focused', () => {
    expect(PAGE).toContain('AXSelectedTextRange')
    expect(landingFrom('AXWebArea', PAGE)).toBe('none')
  })

  it('holds the words back on text somebody can only select', () => {
    expect(LABEL).toContain('AXSelectedTextRange')
    expect(landingFrom('AXStaticText', LABEL)).toBe('none')
  })

  it('holds the words back on a row in Finder', () => {
    expect(landingFrom('AXRow', ROW)).toBe('none')
    expect(landingFrom('AXGroup', ROW)).toBe('none')
  })

  it('takes a role with the spacing the machine left on it', () => {
    expect(landingFrom(' AXTextField ', [])).toBe('text')
  })
})

describe('reading back what the machine printed', () => {
  const printed = (role: string, attributes: readonly string[]): string => `${role}\n${attributes.join(',')}`

  it('reads the two lines osascript prints', () => {
    expect(landingOf(printed('AXTextField', FIELD))).toBe('text')
    expect(landingOf(printed('AXWebArea', PAGE))).toBe('none')
    expect(landingOf(printed('AXGroup', WRITTEN_BOX))).toBe('text')
    expect(landingOf(printed('AXRow', ROW))).toBe('none')
  })

  it('reads it with the trailing newline the command comes back with', () => {
    expect(landingOf(`${printed('AXWebArea', PAGE)}\n`)).toBe('none')
  })

  it('reads an attribute list somebody has spaced out', () => {
    expect(landingOf('AXGroup\nAXRole, AXChildren, AXEditableAncestor')).toBe('text')
  })

  it('takes the bare word unknown at its word', () => {
    expect(landingOf('unknown')).toBe('unknown')
  })

  // An application with nothing open, which is Mail, Messages, Terminal and
  // ChatGPT with every window shut. There really is nowhere for the words to go.
  it('takes the bare word none at its word', () => {
    expect(landingOf('none')).toBe('none')
    expect(landingOf('none\n')).toBe('none')
  })

  it('is unknown when nothing was printed at all', () => {
    expect(landingOf('')).toBe('unknown')
    expect(landingOf('   \n  ')).toBe('unknown')
  })

  it('is unknown when the attribute line never arrived', () => {
    expect(landingOf('AXTextField')).toBe('unknown')
    expect(landingOf('AXWebArea')).toBe('unknown')
  })

  it('is unknown when the role line never arrived', () => {
    expect(landingOf(`\n${FIELD.join(',')}`)).toBe('unknown')
  })
})

// The one thing that costs somebody their sentence. 'text' and 'unknown' both
// paste, so a shape this cannot account for has to fall on one of those: a 'none'
// arrived at by accident is a dictation held behind a button while the field it
// was meant for sits there empty.
describe('nothing malformed is ever held back by accident', () => {
  const malformed = ['', '   ', '\n', 'unknown', 'AXTextField', 'AXWebArea', 'osascript: no such file', '{}', '\n\n']

  it('is never none', () => {
    for (const printed of malformed) expect(landingOf(printed)).not.toBe('none')
  })

  it('is unknown, which pastes the way it always did', () => {
    for (const printed of malformed) expect(landingOf(printed)).toBe('unknown')
  })

  // The two ways the words are ever held back by the machine, and both of them are
  // the machine having really answered: a role came back and it is not somewhere
  // to type, or the application said outright it has nothing open.
  it('only holds them back on a real answer that has nowhere to type in it', () => {
    expect(landingOf('none')).toBe('none')
    expect(landingOf(`AXWebArea\n${PAGE.join(',')}`)).toBe('none')
    expect(landingOf(`AXRow\n${ROW.join(',')}`)).toBe('none')
  })
})

// Crew's own boxes, which are the ones the machine could never see. Every window
// here is Chromium, so all of the above came back as a silence, and the app held
// the words back from its own composer while saying to click into a text box.
describe('what has the caret in one of our own pages', () => {
  it('writes into the composer', () => {
    expect(landingInPage('TEXTAREA', '', false)).toBe('text')
  })

  it('writes into a field', () => {
    expect(landingInPage('INPUT', 'text', false)).toBe('text')
    expect(landingInPage('INPUT', 'search', false)).toBe('text')
    expect(landingInPage('INPUT', 'email', false)).toBe('text')
    expect(landingInPage('INPUT', 'password', false)).toBe('text')
  })

  // The docs, the board and anywhere else the app draws a box of its own rather
  // than taking one from the browser.
  it('writes into anything editable whatever it is drawn as', () => {
    expect(landingInPage('DIV', '', true)).toBe('text')
    expect(landingInPage('P', '', true)).toBe('text')
    expect(landingInPage('SPAN', '', true)).toBe('text')
  })

  it('takes the tag and the type however they were cased', () => {
    expect(landingInPage('textarea', '', false)).toBe('text')
    expect(landingInPage('input', 'TEXT', false)).toBe('text')
    expect(landingInPage(' INPUT ', ' text ', false)).toBe('text')
  })

  // An input the standard has not written yet is somewhere to type until it is
  // known not to be, or the next kind of field added anywhere holds words back
  // from a box they were really in.
  it('writes into an input nobody here has heard of', () => {
    expect(landingInPage('INPUT', 'nothing-yet', false)).toBe('text')
    expect(landingInPage('INPUT', '', false)).toBe('text')
  })

  it('holds the words back on a button and on the rest of the page', () => {
    expect(landingInPage('BUTTON', '', false)).toBe('none')
    expect(landingInPage('BODY', '', false)).toBe('none')
    expect(landingInPage('DIV', '', false)).toBe('none')
    expect(landingInPage('A', '', false)).toBe('none')
  })

  it('holds the words back on an input that is not a box', () => {
    for (const type of ['button', 'checkbox', 'radio', 'submit', 'file', 'range', 'color'])
      expect(landingInPage('INPUT', type, false)).toBe('none')
  })

  // The side panel is a real browser, so the caret can be in a field on somebody
  // else's site while the page around it sees only the box it is drawn in. Held
  // back there, the words are taken off a field they were really in.
  it('will not say for anything holding a page of its own', () => {
    expect(landingInPage('WEBVIEW', '', false)).toBe('unknown')
    expect(landingInPage('IFRAME', '', false)).toBe('unknown')
    expect(landingInPage('webview', '', false)).toBe('unknown')
  })
})
