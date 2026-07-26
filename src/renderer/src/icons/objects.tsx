import { glyph } from '../components/glyph'

// A page is taller than the keyline would like and there is nowhere left to put
// the height, so it takes the cap at 19 and sits a shade light. Pushing further
// only walks it into the edge of the box.
const PAGE_BODY = 'M14.4 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V7.6Z'
const PAGE_FOLD = 'M14.25 3.2v4.4h4.5'

export const FileGlyph = glyph(
  <>
    <path d={PAGE_BODY} />
    <path d={PAGE_FOLD} />
  </>
)

export const DocGlyph = glyph(
  <>
    <path d={PAGE_BODY} />
    <path d={PAGE_FOLD} />
    <path d="M8.5 12.75h7" />
    <path d="M8.5 16.5h4.5" />
  </>
)

export const FolderGlyph = glyph(
  <path d="M3 17.5V6.75A2 2 0 0 1 5 4.75h3.4a2 2 0 0 1 1.45.6l1.2 1.3a2 2 0 0 0 1.45.6H19a2 2 0 0 1 2 2v8.25a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
)

const CRATE_LID = { x: 3.5, y: 4, width: 17, height: 4.5, rx: 1.75 }
const CRATE_BODY = 'M5.25 8.5V18A2 2 0 0 0 7.25 20h9.5a2 2 0 0 0 2-2V8.5'

export const ArchiveGlyph = glyph(
  <>
    <rect {...CRATE_LID} />
    <path d={CRATE_BODY} />
    <path d="M10 12.75h4" />
  </>
)

export const UnarchiveGlyph = glyph(
  <>
    <rect {...CRATE_LID} />
    <path d={CRATE_BODY} />
    <path d="M12 17v-5.25" />
    <path d="m9.5 14.25 2.5-2.5 2.5 2.5" />
  </>
)

// Every screen in the set stands on the same 19 by 15 frame with the same 3
// radius, so a photo, a window and a terminal are one object wearing three
// different insides rather than three drawings that nearly agree.
const SCREEN = { x: 2.5, y: 4.5, width: 19, height: 15, rx: 3 }

export const PhotoGlyph = glyph(
  <>
    <rect {...SCREEN} />
    <circle cx="15.5" cy="9" r="1.6" />
    <path d="m3 17.8 5-5 3.4 3.4 2.4-2.4 5.2 5.2" />
  </>
)

export const FilmGlyph = glyph(
  <>
    <rect {...SCREEN} />
    <path d="M7.5 4.5v15M16.5 4.5v15M7.5 12h9" />
  </>
)

export const WindowGlyph = glyph(
  <>
    <rect {...SCREEN} />
    <path d="M2.5 9.75h19" />
  </>
)

export const TerminalGlyph = glyph(
  <>
    <rect {...SCREEN} />
    <path d="m6.5 9.25 3.25 2.75-3.25 2.75" />
    <path d="M12.75 14.75h5" />
  </>
)

// A case with a handle and a seam across the lid. Wide and shallow rather than
// tall, which is what tells a toolbox from a briefcase at 16px. It is drawn in
// three pieces so the lid can be swung open, and the seam belongs to the lid
// rather than to the case: an open toolbox has nothing across its mouth. Shut,
// the three land back on one outline with one stroke on every edge.
export const TOOLBOX_BODY = 'M2.5 12.75V17a2.5 2.5 0 0 0 2.5 2.5h14a2.5 2.5 0 0 0 2.5-2.5V12.75'
export const TOOLBOX_LID = 'M2.5 12.75V11a2.5 2.5 0 0 1 2.5-2.5h14a2.5 2.5 0 0 1 2.5 2.5v1.75Z'
export const TOOLBOX_HANDLE = 'M8.25 8.5V7.25a2.75 2.75 0 0 1 2.75-2.75h2a2.75 2.75 0 0 1 2.75 2.75V8.5'

// The lid is hinged along the back of the mouth, which is behind the drawing
// rather than on it, and that is what makes the swing read as a turn in space
// instead of a tilt on the page. The front of the lid travels an arc: it lifts
// by the depth of the hinge times the sine of the swing, its own height flattens
// by the cosine the way anything turning away from you does, and the whole of it
// loses a little to the distance it has gone back. Thirty five degrees on a
// hinge four and a half deep is what the grid has room for, since the handle is
// carried up as the lid comes over.
export const TOOLBOX_HINGE = { x: 12, y: 12.75 }
export const TOOLBOX_DEPTH = 4.5
export const TOOLBOX_SWING = 35

// How far off the drawing is being watched from, in the grid's own units. A long
// way, so going back costs a couple of percent rather than turning the lid into
// a different shape.
export const TOOLBOX_AWAY = 34

const to3 = (n: number): number => Math.round(n * 1000) / 1000

// The turn is worked out here and handed over as a lift, a squash and the share
// the lid keeps, which is a plain 2D transform and stays as sharp as the still
// icon at every size. Nothing tapers, and that is on purpose: the case is drawn
// flat on, with no vanishing point anywhere in the set, so a lid that narrowed
// as it went back would be the one part of the drawing standing in a different
// space. The share it keeps is the one wink at distance, small enough to read as
// having gone back rather than as a lid of another size. It would not be worth
// having either way. A perspective on an SVG is not a projection, since Chromium
// flattens it to a skew, and the real thing drawn into the path buys a taper of
// half a pixel and closes the handle up at 22px.
export const toolboxTurn = (
  swing: number = TOOLBOX_SWING
): { rise: number; squash: number; away: number } => {
  const turn = (swing * Math.PI) / 180
  const back = TOOLBOX_DEPTH * (1 - Math.cos(turn))
  return {
    rise: to3(TOOLBOX_DEPTH * Math.sin(turn)),
    squash: to3(Math.cos(turn)),
    away: to3(TOOLBOX_AWAY / (TOOLBOX_AWAY + back))
  }
}

export const ToolboxGlyph = glyph(
  <>
    <path d={TOOLBOX_BODY} />
    <path d={TOOLBOX_LID} />
    <path d={TOOLBOX_HANDLE} />
  </>
)

// The bare prompt, for a step in a thread that ran a command. No frame, because
// it stands in a line of text rather than in a row of objects.
export const PromptGlyph = glyph(
  <>
    <path d="m4.5 5.5 7.5 6.5-7.5 6.5" />
    <path d="M14.5 18.5h5" />
  </>
)

// The tail hangs off the bottom left corner and turns at its point like every
// other corner in the set. The three dots are filled because a 1.5 ring that
// small closes into a smudge, and they are what tells a bubble from a rounded
// box at 16px.
export const ChatGlyph = glyph(
  <>
    <path d="M6.75 4.25h10.5A3.5 3.5 0 0 1 20.75 7.75V13a3.5 3.5 0 0 1-3.5 3.5H9.75l-2.35 2.85q-.65.8-.65-.25V16.5A3.5 3.5 0 0 1 3.25 13V7.75a3.5 3.5 0 0 1 3.5-3.5Z" />
    <circle cx="8" cy="10.4" r=".95" fill="currentColor" stroke="none" />
    <circle cx="12" cy="10.4" r=".95" fill="currentColor" stroke="none" />
    <circle cx="16" cy="10.4" r=".95" fill="currentColor" stroke="none" />
  </>
)

export const DesktopGlyph = glyph(
  <>
    <rect x="2.5" y="4.5" width="19" height="13" rx="3" />
    <path d="M12 17.5v3" />
    <path d="M8 20.5h8" />
  </>
)

export const GlobeGlyph = glyph(
  <>
    <circle cx="12" cy="12" r="9.25" />
    <ellipse cx="12" cy="12" rx="4" ry="9.25" />
    <path d="M2.75 12h18.5" />
  </>
)

export const GroupGlyph = glyph(
  <>
    <path d="M3.5 8V6A2.5 2.5 0 0 1 6 3.5h2M16 3.5h2A2.5 2.5 0 0 1 20.5 6v2M20.5 16v2a2.5 2.5 0 0 1-2.5 2.5h-2M8 20.5H6A2.5 2.5 0 0 1 3.5 18v-2" />
    <rect x="8" y="8" width="8" height="8" rx="2" />
  </>
)

export const CloudGlyph = glyph(
  <path d="M17.3 18.6H7.5a4.9 4.9 0 0 1-.9-9.72 6.2 6.2 0 0 1 11.85 1.55A4.2 4.2 0 0 1 17.3 18.6Z" />
)

// Two figures rather than three: the one in front is whole and the one behind
// keeps only what is not hidden by it. Four marks, because two of anything is
// two objects, and the pair is read as a pair rather than as four shapes.
export const PeopleGlyph = glyph(
  <>
    <circle cx="9" cy="7.9" r="3.55" />
    <path d="M2.6 19.5v-.9a5.5 5.5 0 0 1 5.5-5.5h1.8a5.5 5.5 0 0 1 5.5 5.5v.9" />
    <circle cx="17.6" cy="8.6" r="2.8" />
    <path d="M17 13.4a4.4 4.4 0 0 1 4.4 4.4v1.7" />
  </>
)
