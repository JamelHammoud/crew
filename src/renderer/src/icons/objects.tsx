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

const CRATE_LID = { x: 3.5, y: 4.5, width: 17, height: 4.5, rx: 1.75 }
const CRATE_BODY = 'M5.25 9v9.5A2 2 0 0 0 7.25 20.5h9.5a2 2 0 0 0 2-2V9'

export const ArchiveGlyph = glyph(
  <>
    <rect {...CRATE_LID} />
    <path d={CRATE_BODY} />
    <path d="M10 13.25h4" />
  </>
)

export const UnarchiveGlyph = glyph(
  <>
    <rect {...CRATE_LID} />
    <path d={CRATE_BODY} />
    <path d="M12 17.5v-5.25" />
    <path d="m9.5 14.75 2.5-2.5 2.5 2.5" />
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

// The bare prompt, for a step in a thread that ran a command. No frame, because
// it stands in a line of text rather than in a row of objects.
export const PromptGlyph = glyph(
  <>
    <path d="m4.5 5.5 7.5 6.5-7.5 6.5" />
    <path d="M14.5 18.5h5" />
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
