import { glyph } from '../components/glyph'
import { TOOLBOX_CASE, TOOLBOX_SHUT } from './toolbox'

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

// One hill, running off the frame at both ends rather than standing inside it: a
// picture is a view of something larger, and a peak that stops short of the edges
// reads as a triangle in a box. Both ends land on the frame's own stroke, which
// is what hides the round caps. The sun is solid because an outlined one this
// small closes up at 16 regardless, and a ring that fills unevenly is a smudge
// where a dot is a dot.
export const PhotoGlyph = glyph(
  <>
    <rect {...SCREEN} />
    <circle cx="16" cy="9" r="1.5" fill="currentColor" stroke="none" />
    <path d="M2.5 16.6l4.9-4.9a1.8 1.8 0 0 1 2.5 0l7.8 7.8" />
  </>
)

export const FilmGlyph = glyph(
  <>
    <rect {...SCREEN} />
    <path d="M7.5 4.5v15M16.5 4.5v15M7.5 12h9" />
  </>
)

// A picture that moves, so it is the same screen the photo stands on with a play
// in the middle of it rather than a drawing of its own. Solid, the way the sun in
// the photo is: an outlined triangle this small closes its counter at 16 and
// comes out a smudge, and its corners are turned so it reads as one of these
// rather than as a shard sitting inside one.
export const GifGlyph = glyph(
  <>
    <rect {...SCREEN} />
    <path
      d="M9 9.25Q9 8.5 9.75 9L14.25 11.5Q15 12 14.25 12.5L9.75 15Q9 15.5 9 14.75Z"
      fill="currentColor"
      stroke="none"
    />
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

// A case with a handle and a lid on it. Wide and shallow rather than tall, which
// is what tells a toolbox from a briefcase at 16px. The case is a box of its own
// and closes across the top, so the lid is a lid rather than the upper half of a
// rounded rectangle, and the mouth stays shut behind it when it comes up. The
// geometry is in toolbox.ts, which is also where the open drawing comes from.
export const ToolboxGlyph = glyph(
  <>
    <path d={TOOLBOX_CASE} />
    <path d={TOOLBOX_SHUT.lid} />
    <path d={TOOLBOX_SHUT.handle} />
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

// A pad, held. The shoulders are square across the top and the grips hang off
// the bottom corners with the middle drawn up between them, which is the one
// line that tells this from a rounded box with a plus in it. The cross and the
// pair of buttons are where a hand expects them, and the buttons are filled for
// the reason the sun in the photo is: a 2 ring at that size is a smudge, and a
// dot is a dot.
export const GameGlyph = glyph(
  <>
    <path d="M6 4.5h12a3.5 3.5 0 0 1 3.5 3.5c0 5-.3 8.5-1.6 10.6-.7 1.3-2.5 1.3-3.3 0-.8-1.4-1.8-2.5-3-2.9-.5-.15-1-.2-1.6-.2s-1.1.05-1.6.2c-1.2.4-2.2 1.5-3 2.9-.8 1.3-2.6 1.3-3.3 0C2.8 16.5 2.5 13 2.5 8A3.5 3.5 0 0 1 6 4.5Z" />
    <path d="M8.25 8.4v3.9M6.3 10.35h3.9" />
    <circle cx="15.6" cy="11.35" r="1.05" fill="currentColor" stroke="none" />
    <circle cx="18.05" cy="9.05" r="1.05" fill="currentColor" stroke="none" />
  </>
)

// A dome on three lobes, with eyes. The hem is drawn on a radius wider than
// half its own chord, so the lobes meet at a proper notch: tangent half circles
// meet at a cusp, which is the one sharp point a set of turned corners cannot
// carry. The eyes are filled for the reason the sun in the photo is.
export const GhostGlyph = glyph(
  <>
    <path d="M4.5 20.25V10a7.5 7.5 0 0 1 15 0v10.25a3.25 3.25 0 0 1-5 0 3.25 3.25 0 0 1-5 0 3.25 3.25 0 0 1-5 0Z" />
    <circle cx="9.4" cy="10" r="1.05" fill="currentColor" stroke="none" />
    <circle cx="14.6" cy="10" r="1.05" fill="currentColor" stroke="none" />
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
