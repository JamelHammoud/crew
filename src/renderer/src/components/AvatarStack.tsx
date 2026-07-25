import { useId } from 'react'
import { useTheme } from '../state/theme'
import { avatarColors, avatarInitial } from './avatarColor'

const SIZES = { sm: 22, md: 28 } as const

// Faces in a row, each one taking a bite out of the one behind it. The bite is
// a mask rather than a ring in the surface colour, so whatever is behind the
// stack keeps showing through the gap.
export default function AvatarStack({
  names,
  size = 'sm',
  max = 3,
  gap = 2.5
}: {
  names: string[]
  size?: keyof typeof SIZES
  max?: number
  gap?: number
}) {
  const raw = useId()
  const light = useTheme() === 'light'
  const shown = names.slice(0, max)
  if (shown.length === 0) return null

  const id = raw.replace(/[^a-zA-Z0-9-]/g, '')
  const face = SIZES[size]
  const radius = face / 2
  const step = Math.round(face * 0.68)
  const width = face + step * (shown.length - 1)
  const at = (index: number): number => radius + step * index

  return (
    <svg
      width={width}
      height={face}
      viewBox={`0 0 ${width} ${face}`}
      aria-hidden
      className="shrink-0 select-none"
    >
      <defs>
        {shown.slice(0, -1).map((_, index) => (
          <mask key={index} id={`${id}-${index}`} maskUnits="userSpaceOnUse">
            <rect x="0" y="0" width={width} height={face} fill="#fff" />
            <circle cx={at(index + 1)} cy={radius} r={radius + gap} fill="#000" />
          </mask>
        ))}
      </defs>
      {shown.map((name, index) => {
        const colors = avatarColors(name, light)
        const cut = index < shown.length - 1
        return (
          <g key={`${name}-${index}`} mask={cut ? `url(#${id}-${index})` : undefined}>
            <circle cx={at(index)} cy={radius} r={radius} fill={colors.background} />
            <text
              x={at(index)}
              y={radius}
              textAnchor="middle"
              dominantBaseline="central"
              fill={colors.color}
              fontSize={Math.round(face * 0.44)}
              fontWeight={600}
            >
              {avatarInitial(name)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
