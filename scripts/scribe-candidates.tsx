import { glyph } from '../src/renderer/src/components/glyph'

export const AWaveRuleGlyph = glyph(
  <path d="M4.5 12q1.7-7.5 3.4 0t3.4 0q1.35-4.4 2.7 0H19.5" />
)

export const BWaveAngleGlyph = glyph(<path d="M4.5 12 7 7.5 9.5 16.5 12 9.5 13.5 12H19.5" />)

export const CWaveStopGlyph = glyph(
  <>
    <path d="M3.9 12q1.7-7.5 3.4 0t3.4 0q1.35-4.4 2.7 0H16.9" />
    <circle cx="19.1" cy="12" r="1.15" fill="currentColor" stroke="none" />
  </>
)

export const DWaveCaretGlyph = glyph(
  <>
    <path d="M4.25 12q1.7-7.5 3.4 0t3.4 0q1.35-4.4 2.7 0H16.75" />
    <path d="M19.25 7.5v9" />
  </>
)

export const ELevelRuleGlyph = glyph(
  <>
    <path d="M7.5 15.5V9M12 15.5V4.25M16.5 15.5V10.75" />
    <path d="M4.5 20h15" />
  </>
)

export const FLevelsGlyph = glyph(<path d="M6 9.25v5.5M10 5v14M14 7.75v8.5M18 10.25v3.5" />)

export const GTranscriptGlyph = glyph(
  <>
    <path d="M4.5 7q2.5-7 5 0t5 0t5 0" />
    <path d="M4.5 15.25h15" />
    <path d="M4.5 19.75h10.25" />
  </>
)

export const HFieldGlyph = glyph(
  <>
    <rect x="2.75" y="4.5" width="18.5" height="15" rx="4" />
    <path d="M7 12q1.25-4.5 2.5 0t2.5 0q1-2.6 2 0H17" />
  </>
)

export const INibGlyph = glyph(
  <>
    <path d="M8.5 3H15.5A2.5 2.5 0 0 1 17.75 6.5L12 19.5 6.25 6.5A2.5 2.5 0 0 1 8.5 3Z" />
    <circle cx="12" cy="8.5" r="1.3" fill="currentColor" stroke="none" />
    <path d="M3 20.9h18" />
  </>
)
