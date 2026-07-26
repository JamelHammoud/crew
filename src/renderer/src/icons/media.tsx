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

const SPEAKER_ART = (
  <>
    <path d={CONE} />
    <path d="M17 9.5a3.5 3.5 0 0 1 0 5" />
    <path d="M19.5 6.75a7.25 7.25 0 0 1 0 10.5" />
  </>
)

export const SpeakerGlyph = glyph(SPEAKER_ART)

// Muted keeps the waves and takes the SLASH over the whole of it, like MicOff
// and CameraOff. Two other ways round were tried in the app and both are worse.
// Dropping the waves for the slash leaves the cone alone, which is two thirds of
// a mark standing off to the left, so the icon shrinks and slides the moment it
// is muted. Dropping them for a cross keeps the width but the cross has to reach
// the cone's mouth to carry the weight the waves did, and at 16 its near arm
// fuses into the mouth and the two become one blob with a barb on it. Kept, the
// waves hold the silhouette themselves and the slash has only to negate. It
// threads between the cone and the arcs rather than crossing them, because both
// it and the mark are centred on the same box.
export const SpeakerOffGlyph = glyph(
  <>
    {SPEAKER_ART}
    <path d={SLASH} />
  </>
)

// A handset turned face down, and it is solid for the same reason stop is: a
// handset is a thing rather than a frame, and the crescent an outline leaves
// between its two edges closes into a smudge at the size the button wears it.
// The bells are the whole of what the mark has to say, so they are round, they
// flare wider than the crown, and they hang the full depth of the box. Drawn
// flat, at 19 across and 9 down, it was a dash in a round button: the same
// silhouette as an arch, and nothing about it read as a phone. A solid keeps
// sqrt(w * h) at 16 the way every other one does, which is 19 by 12.6, and that
// is the number that had gone missing rather than the size it was worn at.
export const HangupGlyph = glyph(
  <path
    d="M3.5 11.6C6.1 7.7 8.9 5.7 12 5.7s5.9 2 8.5 5.9c.7 1.1 1 2.1 1 3 0 2.1-1.6 3.7-3.8 3.7-2 0-3.3-1.4-3.3-3.6v-2.9c-.8-.3-1.5-.4-2.4-.4s-1.6.1-2.4.4v2.9c0 2.2-1.3 3.6-3.3 3.6-2.2 0-3.8-1.6-3.8-3.7 0-.9.3-1.9 1-3Z"
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
