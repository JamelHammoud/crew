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

const MAIL_BODY = { x: 2.5, y: 4.5, width: 19, height: 15, rx: 2.5 }
const MAIL_FLAP = 'm3.25 6.5 7.25 5.5a2.5 2.5 0 0 0 3 0l7.25-5.5'

export const MailGlyph = glyph(
  <>
    <rect {...MAIL_BODY} />
    <path d={MAIL_FLAP} />
  </>
)

export const UnreadGlyph = glyph(
  <>
    <rect {...MAIL_BODY} />
    <path d={MAIL_FLAP} />
    <circle cx="18" cy="7.5" r="1.5" fill="currentColor" stroke="none" />
  </>
)

export const InboxGlyph = glyph(
  <>
    <path d="M5.25 4.5h13.5l2.75 9v3.75a2.25 2.25 0 0 1-2.25 2.25H4.75a2.25 2.25 0 0 1-2.25-2.25V13.5Z" />
    <path d="M3 13.5h5.25L10 16.25h4l1.75-2.75H21" />
  </>
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

// A strip of film, so it is the same screen the photo stands on with a rail of
// perforations down each side. Two rails and a bar across the middle was what it
// was, and at 16 that is a window pane rather than a video. The holes are solid,
// the way the sun in the photo is: a ring this small closes its counter whatever
// you do, and a dot is a dot where a ring that fills unevenly is a smudge. Three
// a side rather than two, because the repetition is what says film, and no line
// is drawn beside them: a hole standing between a rail and the frame has half a
// pixel either side of it at 16, and the three of them come out as one bar.
const PERF = { width: 2.75, height: 2, rx: 0.75 }
const PERFS = [7, 11, 15].flatMap(y => [4.25, 17].map(x => ({ ...PERF, x, y })))

export const FilmGlyph = glyph(
  <>
    <rect {...SCREEN} />
    {PERFS.map(hole => (
      <rect key={`${hole.x} ${hole.y}`} {...hole} fill="currentColor" stroke="none" />
    ))}
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

export const PinGlyph = glyph(
  <>
    <path d="M7.25 2.5h9.5L15.5 9l3.75 3.75v2H4.75v-2L8.5 9Z" />
    <path d="M12 14.75v7" />
  </>
)

// The same screen with a panel down one side of it, so a window and a window
// with something beside it are one object wearing two insides. The divider
// stands a third of the way in, which is the least that reads as a panel rather
// than as a frame drawn twice at 16.
export const PanelLeftGlyph = glyph(
  <>
    <rect {...SCREEN} />
    <path d="M9 4.5v15" />
  </>
)

export const PanelRightGlyph = glyph(
  <>
    <rect {...SCREEN} />
    <path d="M15 4.5v15" />
  </>
)

export const ColumnsGlyph = glyph(
  <>
    <rect {...SCREEN} />
    <path d="M12 4.5v15" />
  </>
)

// The same screen with the work heading for its far corner. The arrow stays
// inside the frame, which is what tells this from a link leaving the app: that
// one breaks its own box open and sends the arrow out of it, and this one is a
// window of Crew's own standing somewhere else.
export const PopOutGlyph = glyph(
  <>
    <rect {...SCREEN} />
    <path d="M11.5 8H16v4.5" />
    <path d="m8 16 8-8" />
  </>
)

export const TerminalGlyph = glyph(
  <>
    <rect {...SCREEN} />
    <path d="m6.5 9.25 3.25 2.75-3.25 2.75" />
    <path d="M12.75 14.75h5" />
  </>
)

export const ToolboxGlyph = glyph(
  <>
    <rect x="2.5" y="9" width="19" height="10.5" rx="2.5" />
    <path d="M2.5 12.75H21.5" />
    <path d="M7 9V6.5A2 2 0 0 1 9 4.5h6a2 2 0 0 1 2 2V9" />
  </>
)

export const StickyGlyph = glyph(
  <>
    <path d="M5.5 3.5h13a2 2 0 0 1 2 2V14l-6.5 6.5H5.5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" />
    <path d="M14 20.5V16a2 2 0 0 1 2-2h4.5" />
  </>
)

// A server somebody stood up themselves, which is the one thing a provider with
// no logo of its own ever is. Two bays rather than three: a rack is read off the
// repetition rather than off the count, and three outlined bays at 16 close
// their counters up into one block of hatching. The gap between them is 2.5,
// which is the least two 2 strokes can stand apart and still be two. The lamp is
// the one moment of character and it is filled, the same reason the sun in the
// photo is: a ring that small closes into a smudge where a dot is a dot.
const BAY = { x: 3.5, width: 17, height: 6.25, rx: 2 }
const LAMP = { cx: 7.25, r: 1.2, fill: 'currentColor', stroke: 'none' }

export const ServerGlyph = glyph(
  <>
    <rect {...BAY} y={3.5} />
    <rect {...BAY} y={14.25} />
    <circle {...LAMP} cy={6.625} />
    <circle {...LAMP} cy={17.375} />
  </>
)

export const PlugGlyph = glyph(
  <>
    <path d="M5.9 6.5H18.1A1.5 1.5 0 0 1 19.6 8V12.5A5 5 0 0 1 14.6 17.5H9.4A5 5 0 0 1 4.4 12.5V8A1.5 1.5 0 0 1 5.9 6.5Z" />
    <path d="M8.5 6.5V2.5M15.5 6.5V2.5" />
    <path d="M12 17.5v4" />
  </>
)

export const AtGlyph = glyph(
  <>
    <circle cx="12" cy="12" r="3.5" />
    <path d="M15.5 8.5v4.5c0 1.75 1.25 2.75 3 2.75s2.75-1.75 2.75-3.75a9.25 9.25 0 1 0-3.5 7.25" />
  </>
)

// One ticket, and the whole of it is the silhouette. The two bites out of the
// sides are what tell it from every other rounded box in the set, so they are
// deep: a notch small enough to be tasteful at 48 is gone by 16, and what is
// left is a card. Nothing is drawn inside it, because a line across a shape this
// size reads as two boxes rather than as a perforation.
export const TicketGlyph = glyph(
  <path d="M4.75 4.5H19.25A2.25 2.25 0 0 1 21.5 6.75V9.25A2.75 2.75 0 0 0 21.5 14.75V17.25A2.25 2.25 0 0 1 19.25 19.5H4.75A2.25 2.25 0 0 1 2.5 17.25V14.75A2.75 2.75 0 0 0 2.5 9.25V6.75A2.25 2.25 0 0 1 4.75 4.5Z" />
)

export const MemoryGlyph = glyph(
  <path d="M6.65 2.7H17.35A2.25 2.25 0 0 1 19.6 4.95V20.5Q19.6 21.7 18.59 21.05L12.84 17.34Q12 16.8 11.16 17.34L5.41 21.05Q4.4 21.7 4.4 20.5V4.95A2.25 2.25 0 0 1 6.65 2.7Z" />
)

// The bare prompt, for a step in a thread that ran a command. No frame, because
// it stands in a line of text rather than in a row of objects.
export const PromptGlyph = glyph(
  <>
    <path d="m4.5 5.5 7.5 6.5-7.5 6.5" />
    <path d="M14.5 18.5h5" />
  </>
)

// A round bubble with a mouth in it. The body is a true circle rather than a
// rounded box, r 8.8 about (12.4, 11.8), and the tail is a corner squared off
// out of its lower left: the outline leaves the circle at 170 degrees, turns a
// right angle, and comes back at 96.
//
// That corner is a right angle by construction rather than by eye. The two joins
// are fixed on the circle, so the point where the edges meet square is the one
// standing on the circle that has those two joins as its diameter, which is
// Thales, taken on the far side from the body. Nudged by hand instead it comes
// out at 85 or 95 degrees, and a corner that is nearly square reads as a corner
// drawn wrong where a real one reads as a decision. It is left as a plain corner
// and the round join is what softens it, since a right angle is already blunt:
// the rule about turning every corner is there to keep spikes out of the set.
//
// The tail is wide and it points away to the left. A tail is the one thing that
// tells a bubble from a plain circle, so it is the last mark here to draw small:
// hung off a short flat and dropped a little it reads as a chip out of the edge
// at the 18 this is worn at in the rail.
//
// The three dots are what came off. Three of them is the typing indicator and
// the same mark a thought already wears, so the tab for the place the crew talks
// was drawing somebody who had not said anything yet.
//
// The mouth is a half circle, which is deeper than the smile the face in the set
// wears, and it has to be: that one sits under two eyes that have already said
// the shape is a face, and this one is alone in the round and has nothing to be
// read against. Its ends come up vertical, so it stays a mouth rather than
// settling into the curve of the body behind it. It hangs off the middle of the
// circle, which puts it low in the face the way a mouth sits.
export const ChatGlyph = glyph(
  <>
    <path d="M11.48 20.55A8.8 8.8 0 1 0 3.73 13.33L4 20.81Z" />
    <path d="M8.15 11.8a4.25 4.25 0 0 0 8.5 0" />
  </>
)

export const SendGlyph = glyph(
  <>
    <path d="M19.86 2.56L3.27 8.3Q1.45 8.93 3.25 9.61L9.81 12.12Q11.3 12.7 11.88 14.19L14.39 20.75Q15.07 22.55 15.7 20.73L21.44 4.14Q22.28 1.72 19.86 2.56Z" />
    <path d="M20.08 3.92L11.3 12.7" />
  </>
)

// The book is the Docs tab, where a page is one document. The tab is the place
// the crew's writing lives and DocGlyph is a file with words in it, which is why
// this is a second drawing rather than a change to that one: that mark stands on
// a changed file in the review, on an attachment and on a mention, and every one
// of those is a document rather than a shelf of them.
//
// Both leaves and the spine are one path. The spine runs the whole height and
// meets the outline at both ends, which is the join that would have laid itself
// twice drawn as a mark of its own.
export const BookGlyph = glyph(
  <path d="M12 6.5C10.15 4.9 7.75 4.1 4.8 4.1A1.9 1.9 0 0 0 2.9 6v9.75a1.9 1.9 0 0 0 1.9 1.9c2.95 0 5.35.8 7.2 2.4 1.85-1.6 4.25-2.4 7.2-2.4a1.9 1.9 0 0 0 1.9-1.9V6a1.9 1.9 0 0 0-1.9-1.9c-2.95 0-5.35.8-7.2 2.4ZM12 6.5V20.05" />
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
    <path d="M4 18.5V11a8 8 0 0 1 16 0v7.5a4.45 4.45 0 0 1-8 0 4.45 4.45 0 0 1-8 0Z" />
    <circle cx="9" cy="12.4" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12.4" r="1.2" fill="currentColor" stroke="none" />
  </>
)

export const DesktopGlyph = glyph(
  <path d="M5.5 4.5H18.5A3 3 0 0 1 21.5 7.5V14.5A3 3 0 0 1 18.5 17.5H5.5A3 3 0 0 1 2.5 14.5V7.5A3 3 0 0 1 5.5 4.5ZM12 17.5v3M8 20.5h8" />
)

export const PhoneGlyph = glyph(
  <>
    <rect x="6" y="2.5" width="12" height="19" rx="3" />
    <path d="M10 18.5h4" />
  </>
)

export const ComputerGlyph = glyph(
  <path d="M7.75 3.5H16.25A4.25 4.25 0 0 1 20.5 7.75V16.25A4.25 4.25 0 0 1 16.25 20.5H7.75A4.25 4.25 0 0 1 3.5 16.25V7.75A4.25 4.25 0 0 1 7.75 3.5ZM8.5 12A3.5 3.5 0 0 1 15.5 12A3.5 3.5 0 0 1 8.5 12Z" />
)

export const GlobeGlyph = glyph(
  <path d="M2.75 12A9.25 9.25 0 0 1 21.25 12A9.25 9.25 0 0 1 2.75 12ZM8 12A4 9.25 0 0 1 16 12A4 9.25 0 0 1 8 12ZM2.75 12H21.25" />
)

export const CompassGlyph = glyph(
  <>
    <path d="M2.75 12A9.25 9.25 0 0 1 21.25 12A9.25 9.25 0 0 1 2.75 12Z" />
    <path d="M16.25 7.75 13.5 13.5l-5.75 2.75L10.5 10.5Z" fill="currentColor" stroke="none" />
  </>
)

// Two commits on a line and a third off to one side, which is the drawing
// everyone already reads as what has changed in a project. The nodes are rings
// rather than dots, because three filled dots on a line is the ellipsis with a
// stalk through it. The branch leaves the trunk square and turns up on a
// generous corner rather than peeling off along it: a curve drawn tangent to
// the trunk spends the first third of its length inside the trunk's own stroke,
// and at 16 the two arrive as one thick line with a hook on the end. It leaves
// at the middle of the run, so the gap over it and the gap under it are the
// same, which is the least either can be before the strokes close up.
const NODE = { r: 2.5, trunk: 6.75, branch: 17.25, top: 5.5, foot: 18.5 }

export const BranchGlyph = glyph(
  <>
    <circle cx={NODE.trunk} cy={NODE.top} r={NODE.r} />
    <circle cx={NODE.trunk} cy={NODE.foot} r={NODE.r} />
    <circle cx={NODE.branch} cy={NODE.top} r={NODE.r} />
    <path d="M6.75 8v8" />
    <path d="M6.75 12h6.5a4 4 0 0 0 4-4" />
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
