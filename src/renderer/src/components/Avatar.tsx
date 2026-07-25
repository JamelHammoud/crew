import { useTheme } from '../state/theme'
import { avatarColors, avatarInitial } from './avatarColor'

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

export default function Avatar({
  name,
  size = 'md',
  px,
  presence
}: {
  name: string
  size?: keyof typeof SIZES
  // For places that size themselves in pixels, like a tile on the call stage
  // that grows with the window.
  px?: number
  presence?: 'online' | 'offline'
}) {
  const colors = avatarColors(name, useTheme() === 'light')
  return (
    <span
      className={`${px ? '' : SIZES[size]} relative inline-block shrink-0 self-start`}
      style={px ? { width: px, height: px, fontSize: Math.round(px * 0.36) } : undefined}
    >
      <span
        className="w-full h-full rounded-full font-semibold flex items-center justify-center select-none"
        style={{ backgroundColor: colors.background, color: colors.color }}
      >
        {avatarInitial(name)}
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
