import { useId } from 'react'
import { attachmentFileUrl } from '../../../shared/attachments'
import { useCrew } from '../state/store'
import GeneratedField from './art/GeneratedField'
import { EYE_RADIUS, PET_GRID, petOf } from './art/pet'

const SIZES = {
  xs: 'w-5 h-5',
  sm: 'w-7 h-7',
  md: 'w-10 h-10',
  lg: 'w-12 h-12'
} as const

// The same boxes said as numbers, which is what the picture behind the face is
// sampled and blurred against.
const BOX: Record<keyof typeof SIZES, number> = {
  xs: 20,
  sm: 28,
  md: 40,
  lg: 48
}

const DOTS = {
  xs: 'w-1.5 h-1.5 ring-2',
  sm: 'w-2 h-2 ring-2',
  md: 'w-2.5 h-2.5 ring-2',
  lg: 'w-3 h-3 ring-[2.5px]'
} as const

// A white shape standing on a photograph reads by its shadow, the way a disc on
// the app icon does. It is a share of the box rather than a number of pixels, or
// the same face is lifted off the picture at 48 and pressed flat into it at 20.
// Keep it gentle: a hard black edge under a white mark turns it into a sticker.
const shadowOf = (box: number): string =>
  `drop-shadow(0 ${(box * 0.02).toFixed(2)}px ${(box * 0.05).toFixed(2)}px rgb(0 0 0 / 0.3))`

export default function AgentIcon({
  seed,
  size = 'md',
  presence,
  photo,
  className = ''
}: {
  seed: string
  size?: keyof typeof SIZES
  presence?: 'online' | 'offline'
  // For the tray panel, which is handed the picture rather than the session it
  // came from.
  photo?: string
  className?: string
}) {
  const pet = petOf(seed)
  const box = BOX[size]
  const mask = useId()
  const file = useCrew(state => state.agents.find(agent => agent.id === seed)?.avatar)
  const httpBase = useCrew(state => state.httpBase)
  const src = photo ?? (file && httpBase ? attachmentFileUrl(httpBase, file) : undefined)
  return (
    <span className={`${SIZES[size]} relative inline-block align-middle shrink-0 ${className}`}>
      {src ? (
        <img
          src={src}
          alt=""
          draggable={false}
          className="block w-full h-full rounded-full object-cover"
        />
      ) : (
        <>
          <GeneratedField seed={seed} box={box} className="rounded-full overflow-hidden" />
          {/* The eyes are cut out rather than painted on, the way the arrow is
              cut out of the tile it stands in, so what comes through them is
              whatever the picture is doing behind rather than one fixed colour
              over a surface that changes under it. */}
          <svg
            viewBox={`0 0 ${PET_GRID} ${PET_GRID}`}
            style={{ filter: shadowOf(box) }}
            className="absolute inset-0 w-full h-full"
            aria-hidden
          >
            <mask id={mask}>
              <g transform={`rotate(${pet.tilt} 50 54)`}>
                <path d={pet.body} fill="#fff" stroke="#fff" strokeWidth={7} strokeLinejoin="round" />
                <circle cx={50 - pet.eyeGap / 2} cy={pet.eyeY} r={EYE_RADIUS} fill="#000" />
                <circle cx={50 + pet.eyeGap / 2} cy={pet.eyeY} r={EYE_RADIUS} fill="#000" />
              </g>
            </mask>
            <rect width={PET_GRID} height={PET_GRID} fill="#fff" mask={`url(#${mask})`} />
          </svg>
        </>
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
