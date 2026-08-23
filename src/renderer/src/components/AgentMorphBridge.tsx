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
              data-part="morph-shape"
              d="M30 50 C30 30 38 20 50 20 C62 20 70 30 70 50 C70 70 62 80 50 80 C38 80 30 70 30 50 Z"
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
