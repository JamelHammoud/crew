import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { attachmentFileUrl } from '../../../shared/attachments'
import { useCrew } from '../state/store'
import GeneratedField from './art/GeneratedField'
import { FIELD_LIGHT, PET_GRID, eyeGapAt, eyeSize, petOf, petPath } from './art/pet'
import type { AgentActivity } from './agentActivity'
import AgentActivityMark from './AgentActivityMark'
import AgentMorphBridge from './AgentMorphBridge'

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

const CHANGE_MS = 820

interface Performance {
  current: AgentActivity
  outgoing?: AgentActivity
  changing: boolean
  turn: number
}

function usePerformance(activity: AgentActivity): Performance {
  const [performance, setPerformance] = useState<Performance>({ current: activity, changing: false, turn: 0 })
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useLayoutEffect(() => {
    setPerformance(previous => {
      if (previous.current === activity) return previous
      return { current: activity, outgoing: previous.current, changing: true, turn: previous.turn + 1 }
    })
  }, [activity])

  useEffect(() => {
    if (!performance.changing) return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setPerformance(previous => ({ ...previous, outgoing: undefined, changing: false }))
    }, CHANGE_MS)
    return () => clearTimeout(timer.current)
  }, [performance.changing, performance.turn])

  return performance
}

export default function AgentIcon({
  seed,
  size = 'md',
  px,
  presence,
  photo,
  activity,
  className = ''
}: {
  seed: string
  size?: keyof typeof SIZES
  // For places that size themselves in pixels, the way Avatar does: a face
  // standing beside a row is as tall as the row rather than as tall as whichever
  // step of the ramp happens to be nearest.
  px?: number
  presence?: 'online' | 'offline'
  // For the tray panel, which is handed the picture rather than the session it
  // came from.
  photo?: string
  activity?: AgentActivity
  className?: string
}) {
  const pet = petOf(seed)
  const box = px ?? BOX[size]
  const gap = eyeGapAt(pet, box)
  const eyes = eyeSize(pet)
  const path = petPath(pet, box)
  const mask = useId()
  const unit = box / PET_GRID
  const file = useCrew(state => state.agents.find(agent => agent.id === seed)?.avatar)
  const httpBase = useCrew(state => state.httpBase)
  const shownActivity = activity ?? 'idle'
  const src = photo ?? (file && httpBase ? attachmentFileUrl(httpBase, file) : undefined)
  const performance = usePerformance(src ? 'idle' : shownActivity)
  const style = {
    ...(px ? { width: px, height: px } : {}),
    '--agent-delay': `${-pet.hue * 13}ms`
  } as CSSProperties
  const faceMotion = performance.changing
    ? performance.current === 'idle'
      ? 'incoming'
      : performance.outgoing === 'idle'
        ? 'outgoing'
        : 'hidden'
    : performance.current === 'idle'
      ? 'present'
      : 'hidden'
  return (
    <span
      className={`${px ? '' : SIZES[size]} agent-icon relative inline-block align-middle shrink-0 ${className}`}
      data-activity={shownActivity}
      style={style}
    >
      {src ? (
        <img
          src={src}
          alt=""
          draggable={false}
          className="agent-photo block w-full h-full rounded-full object-cover"
        />
      ) : (
        <span className="agent-pet-body agent-face-stage absolute inset-0" data-motion={faceMotion}>
          <svg viewBox={`0 0 ${box} ${box}`} className="agent-pet-drawing absolute inset-0 w-full h-full" aria-hidden>
            <defs>
              <mask id={mask} maskUnits="userSpaceOnUse" x={0} y={0} width={box} height={box}>
                <path d={path} fill="#fff" />
                <g transform={`rotate(${pet.tilt} ${pet.eyeX * unit} ${pet.eyeY * unit})`}>
                  <g className="agent-pet-eyes">
                    <rect
                      x={(pet.eyeX - gap / 2 - eyes.radius) * unit}
                      y={(pet.eyeY - eyes.height / 2) * unit}
                      width={eyes.width * unit}
                      height={eyes.height * unit}
                      rx={eyes.radius * unit}
                      fill="#000"
                    />
                    <rect
                      x={(pet.eyeX + gap / 2 - eyes.radius) * unit}
                      y={(pet.eyeY - eyes.height / 2) * unit}
                      width={eyes.width * unit}
                      height={eyes.height * unit}
                      rx={eyes.radius * unit}
                      fill="#000"
                    />
                  </g>
                </g>
              </mask>
            </defs>
            <foreignObject width={box} height={box} mask={`url(#${mask})`}>
              <span className="agent-pet-field relative block w-full h-full">
                <GeneratedField seed={seed} box={box} light={FIELD_LIGHT} />
              </span>
            </foreignObject>
          </svg>
        </span>
      )}
      {!src && performance.outgoing && performance.outgoing !== 'idle' && (
        <AgentActivityMark
          key={`out-${performance.turn}-${performance.outgoing}`}
          activity={performance.outgoing}
          seed={seed}
          box={box}
          motion="outgoing"
        />
      )}
      {!src && performance.changing && <AgentMorphBridge key={`bridge-${performance.turn}`} seed={seed} box={box} />}
      {!src && performance.current !== 'idle' && (
        <AgentActivityMark
          key={`in-${performance.turn}-${performance.current}`}
          activity={performance.current}
          seed={seed}
          box={box}
          motion={performance.changing ? 'incoming' : 'working'}
        />
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
