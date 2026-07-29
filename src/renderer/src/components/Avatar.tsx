import { attachmentFileUrl } from '../../../shared/attachments'
import { memberPhoto } from '../../../shared/people'
import { useCrew } from '../state/store'
import { useTheme } from '../state/theme'
import { avatarColors, avatarInitial } from './avatarColor'

const SIZES = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base'
} as const

const DOTS = {
  xs: 'w-1.5 h-1.5 ring-2',
  sm: 'w-2 h-2 ring-2',
  md: 'w-2.5 h-2.5 ring-2',
  lg: 'w-3 h-3 ring-[2.5px]'
} as const

export default function Avatar({
  name,
  size = 'md',
  px,
  presence,
  photo
}: {
  name: string
  size?: keyof typeof SIZES
  // For places that size themselves in pixels, like a tile on the call stage
  // that grows with the window.
  px?: number
  presence?: 'online' | 'offline'
  // For the tray panel, which is handed the picture rather than the session it
  // came from.
  photo?: string
}) {
  const colors = avatarColors(name, useTheme() === 'light')
  const file = useCrew(state => memberPhoto(state.members, name))
  const httpBase = useCrew(state => state.httpBase)
  const src = photo ?? (file && httpBase ? attachmentFileUrl(httpBase, file) : undefined)
  return (
    <span
      className={`${px ? '' : SIZES[size]} relative inline-block align-middle shrink-0`}
      style={px ? { width: px, height: px, fontSize: Math.round(px * 0.36) } : undefined}
    >
      {src ? (
        <img
          src={src}
          alt=""
          draggable={false}
          className="block w-full h-full rounded-full object-cover"
        />
      ) : (
        <span
          className="w-full h-full rounded-full font-semibold flex items-center justify-center"
          style={{ backgroundColor: colors.background, color: colors.color }}
        >
          {avatarInitial(name)}
        </span>
      )}
      {presence && (
        <span
          className={`${DOTS[size]} absolute bottom-0 right-0 z-10 rounded-full ring-ink-900 transition-colors ${
            presence === 'online' ? 'bg-positive' : 'bg-ink-500'
          }`}
        />
      )}
    </span>
  )
}
