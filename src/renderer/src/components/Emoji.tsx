import { lookupEmoji, SHEET_GRID, SHEET_URL } from './emoji'

export default function Emoji({ char, size = 18 }: { char: string; size?: number }) {
  const entry = lookupEmoji(char)
  if (!entry) {
    return (
      <span aria-hidden style={{ fontSize: size, lineHeight: 1 }}>
        {char}
      </span>
    )
  }
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 bg-no-repeat"
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${SHEET_URL})`,
        backgroundSize: `${SHEET_GRID * 100}% ${SHEET_GRID * 100}%`,
        backgroundPosition: `${(entry.x / (SHEET_GRID - 1)) * 100}% ${(entry.y / (SHEET_GRID - 1)) * 100}%`
      }}
    />
  )
}
