import { describe, expect, it } from 'vitest'
import { landingFrom, landingOf } from '../src/shared/scribeLanding'

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
  const printed = (role: string, attributes: readonly string[]): string =>
    `${role}\n${attributes.join(',')}`

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

  // The one that cost Scribe every box anybody really dictates into. A Chromium
  // application hands over no focused element at all until its accessibility tree
  // is built, and nothing here builds it, so Crew, Discord, VS Code, Figma and
  // Chrome all said this the whole time somebody's caret was sitting in a field.
  it('is unknown when the application handed over no focused element', () => {
    expect(landingOf('none')).toBe('unknown')
    expect(landingOf('none\n')).toBe('unknown')
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
  const malformed = [
    '',
    '   ',
    '\n',
    'unknown',
    'AXTextField',
    'AXWebArea',
    'osascript: no such file',
    '{}',
    '\n\n'
  ]

  it('is never none', () => {
    for (const printed of malformed) expect(landingOf(printed)).not.toBe('none')
  })

  it('is unknown, which pastes the way it always did', () => {
    for (const printed of malformed) expect(landingOf(printed)).toBe('unknown')
  })

  // The only two ways the words are ever held back, and both of them are the
  // machine having answered properly.
  it('only holds them back on a real answer that has nowhere to type in it', () => {
    expect(landingOf('none')).toBe('none')
    expect(landingOf(`AXWebArea\n${PAGE.join(',')}`)).toBe('none')
  })
})
