import { useId, type ReactElement } from 'react'
import { MARK_CUT, MARK_DISCS, MARK_HEIGHT, MARK_RADIUS, MARK_WIDTH } from '../crew-mark'

// The mark, standing in a photograph rather than printed on one. It is the same
// three discs the app icon is, lit the way the ones on the blueprint are: a body
// that falls away to the far side, a shade drawn in all round the edge, a light
// rim on the top where the light arrives, a softer one on the bottom where the
// picture throws it back, a specular where the light lands, and a shadow cast
// into the gap behind.
//
// The geometry is `crew-mark.ts` and nothing here, so the mark on a cover is the
// same mark as the one in the top left of the app.

// White, but never quite solid. A disc lets a little of the picture through on
// the side turned away from the light, which is what shades it: the color under
// it is the color it takes, so the mark belongs to whatever cover it is standing
// in rather than being pasted over it.
const BODY = [
  [0, 1],
  [0.34, 0.96],
  [0.68, 0.86],
  [1, 0.72]
] as const

// How much of the tile the mark crosses. It is a small thing in a photograph,
// not a badge filling one.
const SPAN = 0.62

const BOX = MARK_WIDTH / SPAN
const SHIFT = (BOX - MARK_WIDTH) / 2
const MIDDLE = BOX / 2
const AT = MARK_DISCS.map(x => x + SHIFT)

export default function CrewGlass({ className = '' }: { className?: string }) {
  // One cover stands in the list and another at the top of the panel at the same
  // time, so every gradient and mask here is named for the one drawing it. The
  // colons React hands out are taken out: a name is pointed at with `url(#name)`
  // wherever it is used, and one of those is not a place for them.
  const own = useId().replace(/:/g, '')
  const name = (part: string): string => `${part}-${own}`
  const paint = (part: string): string => `url(#${name(part)})`

  // Each disc is cut only by the discs standing in front of it. One mask for the
  // whole stack reopens the gaps.
  const discs = (fill: string): ReactElement[] =>
    AT.map((x, index) => (
      <circle key={index} cx={x} cy={MIDDLE} r={MARK_RADIUS} fill={fill} mask={paint(`cut-${index}`)} />
    ))

  return (
    <svg aria-hidden viewBox={`0 0 ${BOX} ${BOX}`} preserveAspectRatio="xMidYMid meet" className={className}>
      <defs>
        <radialGradient id={name('body')} cx="0.34" cy="0.27" r="0.94">
          {BODY.map(([offset, opacity]) => (
            <stop key={offset} offset={offset} stopColor="#ffffff" stopOpacity={opacity} />
          ))}
        </radialGradient>
        <radialGradient id={name('shade')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.72" stopColor="#0a2f5e" stopOpacity="0" />
          <stop offset="0.93" stopColor="#0a2f5e" stopOpacity="0.07" />
          <stop offset="1" stopColor="#0a2f5e" stopOpacity="0.2" />
        </radialGradient>
        <radialGradient id={name('bounce')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.8" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.95" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={name('edge')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.84" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.97" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={name('gloss')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>

        {/* The two rims are one ring gradient held to opposite halves by a mask,
            which is what makes a flat circle read as a bead. Both run in the
            frame's own units, since all three discs stand on one line. */}
        <linearGradient
          id={name('lower')}
          x1="0"
          y1={MIDDLE + MARK_RADIUS * 0.1}
          x2="0"
          y2={MIDDLE + MARK_RADIUS}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#000000" />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
        <linearGradient
          id={name('upper')}
          x1="0"
          y1={MIDDLE - MARK_RADIUS}
          x2="0"
          y2={MIDDLE - MARK_RADIUS * 0.2}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#000000" />
        </linearGradient>
        <mask id={name('under')} maskUnits="userSpaceOnUse" x="0" y="0" width={BOX} height={BOX}>
          <rect x="0" y="0" width={BOX} height={BOX} fill={paint('lower')} />
        </mask>
        <mask id={name('over')} maskUnits="userSpaceOnUse" x="0" y="0" width={BOX} height={BOX}>
          <rect x="0" y="0" width={BOX} height={BOX} fill={paint('upper')} />
        </mask>

        {AT.map((_, index) => (
          <mask key={index} id={name(`cut-${index}`)} maskUnits="userSpaceOnUse" x="0" y="0" width={BOX} height={BOX}>
            <rect x="0" y="0" width={BOX} height={BOX} fill="#ffffff" />
            {AT.slice(index + 1).map((x, ahead) => (
              <circle key={ahead} cx={x} cy={MIDDLE} r={MARK_CUT} fill="#000000" />
            ))}
          </mask>
        ))}

        <filter id={name('cast')} x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow
            dx="0"
            dy={MARK_HEIGHT * 0.06}
            stdDeviation={MARK_HEIGHT * 0.09}
            floodColor="#04142e"
            floodOpacity="0.3"
          />
        </filter>
      </defs>

      <g filter={paint('cast')}>{discs(paint('body'))}</g>
      <g>{discs(paint('shade'))}</g>
      <g mask={paint('under')}>{discs(paint('bounce'))}</g>
      <g mask={paint('over')}>{discs(paint('edge'))}</g>
      {/* The specular sits where the light is, up and to the left, and is an
          ellipse because a round one on a round body reads as a hole. */}
      {AT.map((x, index) => (
        <ellipse
          key={index}
          cx={x - MARK_RADIUS * 0.26}
          cy={MIDDLE - MARK_RADIUS * 0.46}
          rx={MARK_RADIUS * 0.46}
          ry={MARK_RADIUS * 0.3}
          fill={paint('gloss')}
          mask={paint(`cut-${index}`)}
        />
      ))}
    </svg>
  )
}
