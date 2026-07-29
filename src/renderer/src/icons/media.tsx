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

// The bars on the pill, which is the whole of what Scribe looks like while it is
// running. It is not a second microphone: that one is Voice and the two stand
// near each other in the toolbox, so this one is what a voice does rather than
// what it is spoken into.
//
// Four bars and not five. The mark is worn at 16, where five over the same width
// leaves under two pixels of gap and the run closes into a block. Every bar is
// centred on the same line, which is what tells a level meter from a chart: a
// set of bars standing on a floor is read as quantities beside each other, and
// one growing both ways off a middle is read as loudness. The tall one stands
// second and the rest fall away after it, because an even rise and fall is a
// pattern and a voice is not one.
export const ScribeGlyph = glyph(<path d="M6 9.25v5.5M10 4.5v15M14 7.5v9M18 10.25v3.5" />)

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

// A little horn with one big round note coming out of it. Two thin arcs was the
// technical drawing of a loudspeaker, and at 16px the pair reads as hatching
// rather than as sound: one arc carried far enough out to be its own shape says
// the same thing and leaves the slash somewhere to go. Everything else about it
// is plumper than it was, a deep mouth and corners turned at 2, because this
// mark sits beside a play button and a pet.
const CONE =
  'M4.75 9.5h2.5l4.35-4.6a1.5 1.5 0 0 1 1.9 1.2v11.8a1.5 1.5 0 0 1-1.9 1.2L7.25 14.5H4.75a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2Z'

const SPEAKER_ART = (
  <>
    <path d={CONE} />
    <path d="M17 7.75a4.25 4.25 0 0 1 0 8.5" />
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
//
// Every number in it is read off one ellipse, 16 across and 12.8 down, so the
// crown, the two legs and the bells cannot drift apart from one another. The
// bells are what say telephone: the outer edge runs 28 degrees further round
// than the inner one, which leaves each end cut on a slant and standing wider
// than the crown it hangs from. Drawn as an even bar with its legs cut square it
// was an arch, and an arch reads as a bridge at 18px however deep it is hung.
export const HangupGlyph = glyph(
  <path
    d="M4.04 17.77A9.6 8 0 1 1 19.96 17.77A2.14 2.14 0 0 1 18.36 13.8A6.4 4.8 0 1 0 5.64 13.8A2.14 2.14 0 0 1 4.04 17.77Z"
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

// The transport marks are solid for the reason stop is: they stand in a button
// that is already a circle, and an outlined triangle inside one reads as a
// second ring. Every corner is turned, so a triangle sits in the same family as
// everything else rather than pointing out of it.
export const PlayGlyph = glyph(
  <path
    d="M4.75 4.95Q4.75 2.75 6.7 3.85L18.85 10.9Q20.75 12 18.85 13.1L6.7 20.15Q4.75 21.25 4.75 19.05Z"
    fill="currentColor"
    stroke="none"
  />
)

export const PauseGlyph = glyph(
  <path
    d="M6.55 3.5h1.5a1.75 1.75 0 0 1 1.75 1.75v13.5a1.75 1.75 0 0 1-1.75 1.75h-1.5a1.75 1.75 0 0 1-1.75-1.75V5.25A1.75 1.75 0 0 1 6.55 3.5ZM15.95 3.5h1.5a1.75 1.75 0 0 1 1.75 1.75v13.5a1.75 1.75 0 0 1-1.75 1.75h-1.5a1.75 1.75 0 0 1-1.75-1.75V5.25A1.75 1.75 0 0 1 15.95 3.5Z"
    fill="currentColor"
    stroke="none"
  />
)

// The bar beside the triangle is a stadium rather than a rounded rectangle: it
// is only as wide as two of its own corners, so there is no straight edge left
// to draw.
export const SkipNextGlyph = glyph(
  <path
    d="M4.6 6.15Q4.6 4.3 6 5.2L14.95 11.1Q16.35 12 14.95 12.9L6 18.8Q4.6 19.7 4.6 17.85ZM18.85 4.3a1.25 1.25 0 0 1 1.25 1.25v12.9a1.25 1.25 0 0 1-2.5 0V5.55a1.25 1.25 0 0 1 1.25-1.25Z"
    fill="currentColor"
    stroke="none"
  />
)

export const SkipBackGlyph = glyph(
  <path
    d="M19.4 6.15Q19.4 4.3 18 5.2L9.05 11.1Q7.65 12 9.05 12.9L18 18.8Q19.4 19.7 19.4 17.85ZM5.15 4.3a1.25 1.25 0 0 1 1.25 1.25v12.9a1.25 1.25 0 0 1-2.5 0V5.55a1.25 1.25 0 0 1 1.25-1.25Z"
    fill="currentColor"
    stroke="none"
  />
)

// Two arrows chasing each other round a track, turned at 4 so the corners are
// as fat as the rest of the set and the pair reads as a loop rather than as a
// broken box. It is the one mark here that is wide rather than square: the two
// runs are what enclose it, and each one on its own is a bare line, so it takes
// the width the live area allows and the drops at either end stay short. Lengthen
// them and the corner-to-corner run is longer than the box the set is drawn in.
export const RepeatGlyph = glyph(
  <>
    <path d="M2.5 10.5a4 4 0 0 1 4-4h15M18.9 4.25 21.5 6.5l-2.6 2.25" />
    <path d="M21.5 13.5a4 4 0 0 1-4 4h-15M5.1 19.75 2.5 17.5l2.6-2.25" />
  </>
)
