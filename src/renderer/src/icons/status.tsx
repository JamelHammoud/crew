import { glyph } from '../components/glyph'
import { SLASH } from './keylines'

// One ring, one radius. Every circular icon in the set is this circle, so a
// check, a cross, a clock and a stop read as the same object holding different
// things rather than as four circles that nearly line up.
const RING = { cx: 12, cy: 12, r: 9.25 }

export const CheckCircleGlyph = glyph(
  <>
    <circle {...RING} />
    <path d="m7.7 12.2 2.85 2.85 5.45-6" />
  </>
)

export const XCircleGlyph = glyph(
  <>
    <circle {...RING} />
    <path d="m8.75 8.75 6.5 6.5M15.25 8.75 8.75 15.25" />
  </>
)

export const StopGlyph = glyph(
  <>
    <circle {...RING} />
    <rect x="8.6" y="8.6" width="6.8" height="6.8" rx="1.9" />
  </>
)

export const ClockGlyph = glyph(
  <>
    <circle {...RING} />
    <path d="M12 6.75V12l3.5 2.25" />
  </>
)

export const QuestionGlyph = glyph(
  <>
    <circle {...RING} />
    <path d="M9.4 9.5a2.72 2.72 0 0 1 5.33.54c0 1.85-2.72 2.29-2.72 3.92" />
    <path d="M12 16.7v.4" />
  </>
)

// The eyes and the mouth are the only place in the set where a mark exists to
// be liked rather than to be read.
export const SmileGlyph = glyph(
  <>
    <circle {...RING} />
    <path d="M8.5 10.25v.4M15.5 10.25v.4" />
    <path d="M8.25 14.5a4.5 4.5 0 0 0 7.5 0" />
  </>
)

// A triangle fills half its box, so it takes the whole live area and still runs
// a little light. Its corners are turned at 1.5 like everything else: a sharp
// point beside a rounded set reads as a different family.
export const WarningGlyph = glyph(
  <>
    <path d="M13.2 4.4 20.6 17.6A1.5 1.5 0 0 1 19.3 19.9H4.7a1.5 1.5 0 0 1-1.3-2.3L10.8 4.4a1.4 1.4 0 0 1 2.4 0Z" />
    <path d="M12 9.75v4" />
    <path d="M12 16.6v.4" />
  </>
)

export const SignalGlyph = glyph(
  <>
    <path d="M6.1 19.25a10 10 0 0 1 0-14.5" />
    <path d="M17.9 4.75a10 10 0 0 1 0 14.5" />
    <circle cx="12" cy="12" r="2.75" />
  </>
)

const SHACKLE_BODY = { x: 4.5, y: 10.5, width: 15, height: 10, rx: 2.75 }

export const LockGlyph = glyph(
  <>
    <rect {...SHACKLE_BODY} />
    <path d="M8 10.5V7.75a4 4 0 0 1 8 0v2.75" />
  </>
)

export const UnlockGlyph = glyph(
  <>
    <rect {...SHACKLE_BODY} />
    <path d="M8 10.5V7.75a4 4 0 0 1 7.5-1.9" />
  </>
)

// Inner points at 47% of the outer radius rather than the 38% a pentagram gives.
// The sharper star is the correct one and the friendlier one is this.
export const StarGlyph = glyph(
  <path d="M12 3.5 14.6 9.32 20.94 10 16.2 14.27 17.53 20.5 12 17.32 6.47 20.5 7.8 14.27 3.06 10 9.4 9.32Z" />
)

export const SunGlyph = glyph(
  <>
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 2.75v2.4M12 18.85v2.4M21.25 12h-2.4M5.15 12H2.75" />
    <path d="m18.55 5.45-1.7 1.7M7.15 16.85l-1.7 1.7M18.55 18.55l-1.7-1.7M7.15 7.15l-1.7-1.7" />
  </>
)

export const MoonGlyph = glyph(
  <path d="M20.4 14.7A8.9 8.9 0 0 1 9.3 3.6 8.85 8.85 0 1 0 20.4 14.7Z" />
)

// The eye is the flattest thing in the set. It cannot reach the keyline without
// becoming a different shape, so it takes the full width instead and is allowed
// to sit light.
export const EyeGlyph = glyph(
  <>
    <path d="M2.5 12c2.05-3.7 5.45-5.75 9.5-5.75s7.45 2.05 9.5 5.75c-2.05 3.7-5.45 5.75-9.5 5.75S4.55 15.7 2.5 12Z" />
    <circle cx="12" cy="12" r="2.9" />
  </>
)

export const EyeOffGlyph = glyph(
  <>
    <path d="M2.5 12c2.05-3.7 5.45-5.75 9.5-5.75s7.45 2.05 9.5 5.75c-2.05 3.7-5.45 5.75-9.5 5.75S4.55 15.7 2.5 12Z" />
    <circle cx="12" cy="12" r="2.9" />
    <path d={SLASH} />
  </>
)
