import { useId } from 'react'
import GeneratedField from './art/GeneratedField'
import { FIELD_LIGHT } from './art/pet'
import type { AgentActivity } from './agentActivity'

function ActivityShape({ activity }: { activity: Exclude<AgentActivity, 'idle'> }) {
  if (activity === 'thinking') {
    return (
      <>
        <g data-part="thought-cloud">
          <path d="M21 74 C11 72 5 63 8 53 C2 45 6 34 16 30 C17 20 27 14 37 16 C45 7 59 7 68 15 C80 13 91 22 91 34 C100 40 100 53 92 60 C90 71 78 77 68 74 C58 82 43 81 34 74 C30 76 25 76 21 74 Z" />
          <circle data-part="thought-tail-one" cx="25" cy="84" r="7.5" />
          <circle data-part="thought-tail-two" cx="13" cy="94" r="4" />
        </g>
        <circle data-part="thought-dot-one" cx="33" cy="45" r="7" fill="#000" />
        <circle data-part="thought-dot-two" cx="51" cy="45" r="7" fill="#000" />
        <circle data-part="thought-dot-three" cx="69" cy="45" r="7" fill="#000" />
      </>
    )
  }
  if (activity === 'reading') {
    return (
      <>
        <path
          data-part="page-left"
          d="M9 22 C21 17 36 20 47 29 C49 31 50 34 50 37 V85 C38 77 24 75 11 80 C6 82 3 78 3 73 V31 C3 27 5 24 9 22 Z"
        />
        <path
          data-part="page-right"
          d="M91 22 C79 17 64 20 53 29 C51 31 50 34 50 37 V85 C62 77 76 75 89 80 C94 82 97 78 97 73 V31 C97 27 95 24 91 22 Z"
        />
        <path data-part="page-line-left" d="M17 39 C25 37 33 39 40 43" fill="none" stroke="#000" strokeWidth="6" strokeLinecap="round" />
        <path data-part="page-line-right" d="M60 43 C68 39 76 37 84 39" fill="none" stroke="#000" strokeWidth="6" strokeLinecap="round" />
        <path data-part="page-turn" d="M53 30 C66 21 80 19 91 22 C77 24 66 32 59 45 C58 38 56 33 53 30 Z" />
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
      <>
        <path
          data-part="writing-stroke"
          d="M10 88 C25 76 37 95 53 87 C66 80 77 84 92 89"
          fill="none"
          stroke="#fff"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <g data-part="writing-pen">
          <path d="M70 7 C76 2 84 3 89 8 L93 12 C98 17 98 25 93 30 L43 76 L22 81 L27 60 Z" />
          <path d="M27 60 L43 76 L22 81 Z" fill="#000" />
          <path d="M30 70 L34 74" fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" />
          <path d="M68 18 L84 34" fill="none" stroke="#000" strokeWidth="6" strokeLinecap="round" />
        </g>
      </>
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
        <path
          data-part="paint-stroke"
          d="M10 90 C17 80 27 81 34 89 C42 98 55 97 65 89 C74 82 83 83 92 88"
          fill="none"
          stroke="#fff"
          strokeWidth="8"
          strokeLinecap="round"
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
          d="M49 65 H60"
          fill="none"
          stroke="#000"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <circle data-part="terminal-command-one" cx="50" cy="42" r="4" fill="#000" />
        <circle data-part="terminal-command-two" cx="63" cy="42" r="4" fill="#000" />
        <circle data-part="terminal-command-three" cx="76" cy="42" r="4" fill="#000" />
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
      <>
        <path
          data-part="message"
          d="M13 39 L85 8 C93 5 98 11 95 19 L67 89 C64 97 57 98 53 90 L41 68 L20 56 C11 51 7 43 13 39 Z M42 61 L77 25 L35 54 Z"
          fillRule="evenodd"
        />
        <path
          data-part="message-wake-one"
          d="M8 70 C18 67 26 68 34 73"
          fill="none"
          stroke="#fff"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          data-part="message-wake-two"
          d="M13 84 C22 81 29 82 36 86"
          fill="none"
          stroke="#fff"
          strokeWidth="6"
          strokeLinecap="round"
        />
      </>
    )
  }
  return (
    <>
      <path data-part="wrench-head" d="M57 6 C68 8 77 15 81 25 L69 37 L59 35 L56 25 L67 14 C63 11 59 9 57 6 Z" />
      <path
        data-part="wrench-handle"
        d="M58 31 C65 38 65 49 59 56 L25 92 C20 97 12 97 7 92 C2 87 3 79 8 74 L42 39 C46 34 52 31 58 31 Z"
      />
      <circle data-part="tool-spark-one" cx="87" cy="21" r="5" />
      <path
        data-part="tool-spark-two"
        d="M83 39 L93 44"
        fill="none"
        stroke="#fff"
        strokeWidth="7"
        strokeLinecap="round"
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
