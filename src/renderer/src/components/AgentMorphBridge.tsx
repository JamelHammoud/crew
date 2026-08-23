import { useId } from 'react'
import GeneratedField from './art/GeneratedField'
import { FIELD_LIGHT } from './art/pet'

export default function AgentMorphBridge({ seed, box }: { seed: string; box: number }) {
  const mask = useId()
  return (
    <span className="agent-morph-bridge absolute inset-0">
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" aria-hidden>
        <defs>
          <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
            <path
              d="M18 44 C21 27 36 18 52 21 C70 17 84 29 82 47 C88 63 75 79 58 78 C42 84 23 75 21 59 C14 55 13 48 18 44 Z"
              fill="#fff"
            />
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
