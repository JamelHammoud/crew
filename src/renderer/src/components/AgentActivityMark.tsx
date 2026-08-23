import { useId } from 'react'
import GeneratedField from './art/GeneratedField'
import { FIELD_LIGHT } from './art/pet'
import type { AgentActivity } from './agentActivity'

function ActivityShape({ activity }: { activity: Exclude<AgentActivity, 'idle'> }) {
  if (activity === 'thinking') {
    return (
      <>
        <g data-part="thought-cloud">
          <path d="M18 22 C25 10 39 7 52 11 C65 6 82 12 87 25 C98 31 99 47 91 56 C91 69 79 78 66 76 C56 84 39 82 32 74 C18 77 7 67 9 54 C1 45 6 29 18 22 Z" />
          <circle cx="24" cy="84" r="7" />
          <circle cx="12" cy="94" r="3.5" />
        </g>
        <circle data-part="thought-dot-one" cx="35" cy="45" r="6.5" fill="#000" />
        <circle data-part="thought-dot-two" cx="53" cy="45" r="6.5" fill="#000" />
        <circle data-part="thought-dot-three" cx="71" cy="45" r="6.5" fill="#000" />
      </>
    )
  }
  if (activity === 'reading') {
    return (
      <>
        <path
          data-part="page-left"
          d="M8 22 C20 17 34 19 47 28 L47 85 C34 76 21 74 8 79 C5 80 3 77 3 73 L3 29 C3 25 5 23 8 22 Z"
        />
        <path
          data-part="page-right"
          d="M92 22 C80 17 66 19 53 28 L53 85 C66 76 79 74 92 79 C95 80 97 77 97 73 L97 29 C97 25 95 23 92 22 Z"
        />
        <path
          data-part="page-turn"
          d="M53 29 C65 20 78 19 89 22 C75 25 67 34 64 49 C61 40 57 33 53 29 Z"
          fill="#000"
        />
        <path data-part="page-spine" d="M50 31 V84" fill="none" stroke="#000" strokeWidth="5" strokeLinecap="round" />
      </>
    )
  }
  if (activity === 'searching') {
    return (
      <>
        <g data-part="search-lens">
          <circle cx="43" cy="40" r="32" />
          <circle cx="43" cy="40" r="20" fill="#000" />
          <path
            data-part="search-glint"
            d="M29 27 C34 22 41 20 47 21"
            fill="none"
            stroke="#fff"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </g>
        <path
          data-part="search-handle"
          d="M62 61 C66 57 71 58 75 62 L94 81 C99 86 99 92 94 96 C90 100 84 99 80 95 L61 76 C57 72 57 66 62 61 Z"
        />
      </>
    )
  }
  if (activity === 'editing') {
    return (
      <path
        data-part="pencil"
        d="M69 8 C74 3 81 3 86 8 L92 14 C97 19 97 26 92 31 L39 84 L14 94 C9 96 5 92 7 87 L17 62 Z M22 69 L31 78 L73 36 L64 27 Z"
        fillRule="evenodd"
      />
    )
  }
  if (activity === 'designing') {
    return (
      <>
        <path
          data-part="brush-handle"
          d="M61 5 C69 3 77 8 80 16 C81 20 80 24 79 28 L65 65 C62 73 54 77 47 74 C40 71 37 64 40 56 L54 16 C55 11 57 7 61 5 Z"
        />
        <path
          data-part="brush-tip"
          d="M38 66 C47 64 56 72 56 81 C56 89 49 93 36 97 C32 98 30 96 29 92 L25 81 C22 73 29 67 38 66 Z"
        />
      </>
    )
  }
  if (activity === 'running') {
    return (
      <>
        <rect data-part="terminal" x="5" y="13" width="90" height="74" rx="17" />
        <path
          data-part="terminal-prompt"
          d="M23 35 L38 50 L23 65"
          fill="none"
          stroke="#000"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          data-part="terminal-cursor"
          d="M48 66 H73"
          fill="none"
          stroke="#000"
          strokeWidth="8"
          strokeLinecap="round"
        />
      </>
    )
  }
  if (activity === 'planning') {
    return (
      <>
        <path
          data-part="plan-board"
          d="M20 12 H80 C87 12 91 17 91 24 V88 C91 94 87 97 80 97 H20 C13 97 9 94 9 88 V24 C9 17 13 12 20 12 Z"
        />
        <rect data-part="plan-clip" x="32" y="5" width="36" height="17" rx="8.5" />
        <path
          data-part="plan-check-one"
          d="M25 42 L31 48 L42 35"
          fill="none"
          stroke="#000"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          data-part="plan-line-one"
          d="M50 43 H75"
          fill="none"
          stroke="#000"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          data-part="plan-check-two"
          d="M25 68 L31 74 L42 61"
          fill="none"
          stroke="#000"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          data-part="plan-line-two"
          d="M50 69 H75"
          fill="none"
          stroke="#000"
          strokeWidth="6"
          strokeLinecap="round"
        />
      </>
    )
  }
  if (activity === 'communicating') {
    return (
      <path
        data-part="message"
        d="M8 43 L86 8 C93 5 98 10 95 17 L63 92 C61 97 55 97 52 92 L39 68 L16 56 C9 53 5 47 8 43 Z M40 62 L77 25 L33 55 Z"
        fillRule="evenodd"
      />
    )
  }
  return (
    <>
      <path data-part="wrench-head" d="M57 6 C68 8 77 15 81 25 L69 37 L59 35 L56 25 L67 14 C63 11 59 9 57 6 Z" />
      <path
        data-part="wrench-handle"
        d="M58 31 C65 38 65 49 59 56 L25 92 C20 97 12 97 7 92 C2 87 3 79 8 74 L42 39 C46 34 52 31 58 31 Z"
      />
    </>
  )
}

export default function AgentActivityMark({
  activity,
  seed,
  box,
  src,
  motion = 'working'
}: {
  activity: Exclude<AgentActivity, 'idle'>
  seed: string
  box: number
  src?: string
  motion?: 'incoming' | 'outgoing' | 'working'
}) {
  const mask = useId()
  return (
    <span className="agent-activity-stage absolute inset-0" data-motion={motion}>
      <span className="agent-activity-object absolute inset-0" data-object={activity}>
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" aria-hidden>
          <defs>
            <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
              <g fill="#fff">
                <ActivityShape activity={activity} />
              </g>
            </mask>
          </defs>
          <foreignObject width="100" height="100" mask={`url(#${mask})`}>
            <span className="relative block w-full h-full">
              {src ? (
                <img src={src} alt="" draggable={false} className="block w-full h-full object-cover" />
              ) : (
                <GeneratedField seed={seed} box={box} light={FIELD_LIGHT} />
              )}
            </span>
          </foreignObject>
        </svg>
      </span>
    </span>
  )
}
