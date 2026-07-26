import { glyph } from '../components/glyph'
import { SLASH } from './keylines'

const MIC_ART = (
  <>
    <rect x="8.75" y="2.75" width="6.5" height="11.5" rx="3.25" />
    <path d="M5.5 11.5v.75a6.5 6.5 0 0 0 13 0v-.75" />
    <path d="M12 18.75v2.5" />
  </>
)

export const MicGlyph = glyph(MIC_ART)

export const MicOffGlyph = glyph(
  <>
    {MIC_ART}
    <path d={SLASH} />
  </>
)

const CAMERA_ART = (
  <>
    <rect x="2.5" y="5" width="13.5" height="14" rx="3" />
    <path d="M16 10.5 20 7.65a1 1 0 0 1 1.5.85v7a1 1 0 0 1-1.5.85L16 13.5Z" />
  </>
)

export const CameraGlyph = glyph(CAMERA_ART)

export const CameraOffGlyph = glyph(
  <>
    {CAMERA_ART}
    <path d={SLASH} />
  </>
)

const CONE =
  'M4 9.5h3.25L12.5 5.25a.75.75 0 0 1 1.25.6v12.3a.75.75 0 0 1-1.25.6L7.25 14.5H4a1.25 1.25 0 0 1-1.25-1.25v-2.5A1.25 1.25 0 0 1 4 9.5Z'

export const SpeakerGlyph = glyph(
  <>
    <path d={CONE} />
    <path d="M17 9.5a3.5 3.5 0 0 1 0 5" />
    <path d="M19.5 6.75a7.25 7.25 0 0 1 0 10.5" />
  </>
)

// Muted drops the waves rather than striking them through. The cross is the
// whole message and a slash over three arcs at 16px is four marks arguing.
export const SpeakerOffGlyph = glyph(
  <>
    <path d={CONE} />
    <path d="m16.75 9.75 5 4.5M21.75 9.75l-5 4.5" />
  </>
)

// A handset turned face down, and it is solid for the same reason stop is: a
// handset is a thing rather than a frame, and the crescent an outline leaves
// between its two edges closes into a smudge at the size the button wears it.
// The two bells hang well below the grip so the silhouette is a phone rather
// than an arch, which is the whole of what the mark has to say.
export const HangupGlyph = glyph(
  <path
    d="M2.75 12.9C5.3 9.35 8.4 7.4 12 7.4s6.7 1.95 9.25 5.5c-1.4 2.15-2.7 3.2-3.9 3.2-1.5 0-2.35-1.15-2.35-3V11.1c-1-.3-1.95-.45-3-.45s-2 .15-3 .45v2c0 1.85-.85 3-2.35 3-1.2 0-2.5-1.05-3.9-3.2Z"
    fill="currentColor"
  />
)

export const HandGlyph = glyph(
  <>
    <path d="M9.3 12V6a1.75 1.75 0 0 1 3.5 0v5" />
    <path d="M12.8 10.5V4.5a1.75 1.75 0 0 1 3.5 0V11" />
    <path d="M16.3 11.5V7.25a1.75 1.75 0 0 1 3.5 0v7a7 7 0 0 1-7 7 6.5 6.5 0 0 1-4.6-1.9L4.8 16a1.75 1.75 0 0 1 2.5-2.45l2 2.05" />
  </>
)

// Four corners rather than four diagonal arrows. The arrows are eight strokes
// where the corners are four, and at 16px the eight turn into a smudge.
export const ExpandGlyph = glyph(
  <path d="M9.5 4.5h-5v5M14.5 4.5h5v5M19.5 14.5v5h-5M4.5 14.5v5h5" />
)

export const CollapseGlyph = glyph(
  <path d="M4.5 9.5h5v-5M19.5 9.5h-5v-5M14.5 19.5v-5h5M9.5 19.5v-5h-5" />
)

// Two beamed notes rather than one. A single head with a flag is mostly stem at
// 16px, where the pair reads as music from across the room. The heads follow the
// beam down rather than standing level, which is what tells a pair of notes from
// two circles on a pole.
// The heads and the stems are one path rather than three shapes, because a stem
// meets its head where the two strokes would otherwise lie on top of each other.
// Worn at an opacity, as a tile that is not ready for pressing is, two stacked
// strokes paint twice and the join comes out darker than the mark around it. One
// element is painted once, whatever it crosses.
export const MusicGlyph = glyph(
  <path d="M9.25 18.25a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0M19.75 16.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0M9.25 18.25V5l10.5-1.75V16.5" />
)
