import { glyph } from '../src/renderer/src/components/glyph'

export const WaveRuleGlyph = glyph(
  <path d="M4.5 12q1.7-7.5 3.4 0t3.4 0q1.35-4.4 2.7 0H19.5" />
)

export const WaveAngleGlyph = glyph(<path d="M4.5 12 7 7.5 9.5 16.5 12 9.5 13.5 12H19.5" />)

export const WaveStopGlyph = glyph(
  <>
    <path d="M3.9 12q1.7-7.5 3.4 0t3.4 0q1.35-4.4 2.7 0H16.9" />
    <circle cx="19.1" cy="12" r="1.15" fill="currentColor" stroke="none" />
  </>
)

export const LevelRuleGlyph = glyph(
  <>
    <path d="M7.5 16.25V9.75M12 16.25V4.75M16.5 16.25V11.5" />
    <path d="M4.5 19.5h15" />
  </>
)

export const LevelsGlyph = glyph(
  <path d="M6 9.25v5.5M10 5v14M14 7.75v8.5M18 10.25v3.5" />
)

export const TranscriptGlyph = glyph(
  <>
    <path d="M4.5 7.25q3.75-6 7.5 0t7.5 0" />
    <path d="M4.5 15h15" />
    <path d="M4.5 19.5h10.25" />
  </>
)

export const NibGlyph = glyph(
  <>
    <path d="M8.5 3H15.5A2.5 2.5 0 0 1 17.75 6.5L12 19.5 6.25 6.5A2.5 2.5 0 0 1 8.5 3Z" />
    <circle cx="12" cy="8.5" r="1.3" fill="currentColor" stroke="none" />
    <path d="M3 20.9h18" />
  </>
)

export const NibWaveGlyph = glyph(
  <>
    <path d="M9.3 2.75H14.7A2 2 0 0 1 16.45 5.5L12 15.5 7.55 5.5A2 2 0 0 1 9.3 2.75Z" />
    <circle cx="12" cy="7" r="1.15" fill="currentColor" stroke="none" />
    <path d="M4.5 19q3.75-3 7.5 0t7.5 0" />
  </>
)

export const PillGlyph = glyph(
  <>
    <rect x="2.75" y="7.5" width="18.5" height="9" rx="4.5" />
    <path d="M8 10.75v2.5M12 9.5v5M16 11.25v1.5" />
  </>
)
