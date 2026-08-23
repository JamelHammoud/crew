import { useEffect, useId, useMemo, useRef } from 'react'
import { interpolate } from 'flubber'
import { svgPathProperties } from 'svg-path-properties'
import GeneratedField from './art/GeneratedField'
import { FIELD_LIGHT, petOf } from './art/pet'
import type { AgentActivity } from './agentActivity'
import { AGENT_MORPH_MS, morphDrawing } from './agentMorph'

const ease = (progress: number): number =>
  progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2

const ring = (path: string): Array<[number, number]> => {
  const geometry = new svgPathProperties(path)
  const length = geometry.getTotalLength()
  return Array.from({ length: 64 }, (_, index) => {
    const point = geometry.getPointAtLength((length * index) / 64)
    return [point.x, point.y]
  })
}

export default function AgentMorphBridge({
  seed,
  box,
  from,
  to
}: {
  seed: string
  box: number
  from: AgentActivity
  to: AgentActivity
}) {
  const mask = useId()
  const body = useRef<SVGPathElement>(null)
  const features = useRef<Array<SVGPathElement | null>>([])
  const source = useMemo(() => morphDrawing(from, petOf(seed)), [from, seed])
  const target = useMemo(() => morphDrawing(to, petOf(seed)), [to, seed])

  useEffect(() => {
    const paths = [body.current, ...features.current]
    const starts = [source.body, ...source.features]
    const ends = [target.body, ...target.features]
    const mixers = starts.map((start, index) =>
      interpolate(ring(start), ring(ends[index]), { maxSegmentLength: Number.POSITIVE_INFINITY })
    )
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      paths.forEach((path, index) => path?.setAttribute('d', ends[index]))
      return
    }
    let frame = 0
    let started = 0
    const draw = (now: number) => {
      if (!started) started = now
      const progress = Math.min(1, (now - started) / AGENT_MORPH_MS)
      const position = ease(progress)
      paths.forEach((path, index) => path?.setAttribute('d', mixers[index](position)))
      if (progress < 1) frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [source, target])

  return (
    <span className="agent-morph-bridge absolute inset-0" data-from={from} data-to={to}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" aria-hidden>
        <defs>
          <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
            <path ref={body} data-part="morph-body" d={source.body} fill="#fff" />
            {source.features.map((path, index) => (
              <path
                key={index}
                ref={node => {
                  features.current[index] = node
                }}
                data-part={`morph-feature-${index + 1}`}
                d={path}
                fill="#000"
              />
            ))}
          </mask>
        </defs>
        <foreignObject width="100" height="100" mask={`url(#${mask})`}>
          <span className="relative block w-full h-full">
            <GeneratedField seed={seed} box={box} light={FIELD_LIGHT} />
          </span>
        </foreignObject>
      </svg>
    </span>
  )
}
