import { useTheme } from '../state/theme'

const SIZES = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base'
} as const

const DOTS = {
  sm: 'w-2 h-2 ring-2',
  md: 'w-2.5 h-2.5 ring-2',
  lg: 'w-3 h-3 ring-[2.5px]'
} as const

function hueOf(name: string): number {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360
  return hash
}

export default function Avatar({
  name,
  size = 'md',
  presence
}: {
  name: string
  size?: keyof typeof SIZES
  presence?: 'online' | 'offline'
}) {
  const hue = hueOf(name.trim().toLowerCase())
  return (
    <span className={`${SIZES[size]} relative inline-block shrink-0 self-start`}>
      <span
        className="w-full h-full rounded-full font-semibold flex items-center justify-center select-none"
        style={{
          backgroundColor: `oklch(0.32 0.045 ${hue})`,
          color: `oklch(0.87 0.06 ${hue})`
        }}
      >
        {name.trim().charAt(0).toUpperCase() || '?'}
      </span>
      {presence && (
        <span
          className={`${DOTS[size]} absolute bottom-0 right-0 rounded-full ring-ink-900 transition-colors ${
            presence === 'online' ? 'bg-positive' : 'bg-ink-500'
          }`}
        />
      )}
    </span>
  )
}
