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

export const HangupGlyph = glyph(
  <path d="M4 14.9 2.6 13.5a.95.95 0 0 1 .05-1.4C5.2 9.85 8.45 8.65 12 8.65s6.8 1.2 9.35 3.45a.95.95 0 0 1 .05 1.4L20 14.9a1.1 1.1 0 0 1-1.45.05 11.6 11.6 0 0 0-2.45-1.55v-2.35a12.4 12.4 0 0 0-8.2 0v2.35a11.6 11.6 0 0 0-2.45 1.55A1.1 1.1 0 0 1 4 14.9Z" />
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
// 16px, where the pair reads as music from across the room.
export const MusicGlyph = glyph(
  <>
    <circle cx="6.75" cy="18.75" r="2.25" />
    <circle cx="17.25" cy="18.75" r="2.25" />
    <path d="M9 18.75V4.75L19.5 3v15.75" />
  </>
)
