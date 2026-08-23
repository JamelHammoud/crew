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
        <rect data-part="writing-card" x="8" y="7" width="84" height="86" rx="27" />
        <path data-part="writing-line-one" d="M25 32 H63" fill="none" stroke="#000" strokeWidth="8" strokeLinecap="round" />
        <path data-part="writing-line-two" d="M25 51 H76" fill="none" stroke="#000" strokeWidth="8" strokeLinecap="round" />
        <path data-part="writing-line-three" d="M25 70 H55" fill="none" stroke="#000" strokeWidth="8" strokeLinecap="round" />
        <circle data-part="writing-caret" cx="68" cy="70" r="5" fill="#000" />
      </>
    )
  }
  if (activity === 'designing') {
    return (
      <>
        <path
          data-part="brush-handle"
          d="M66 5 C73 1 82 4 86 11 C89 16 88 22 85 27 L61 60 C57 66 48 67 42 63 C36 59 35 50 40 44 L66 5 Z"
        />
        <path
          data-part="brush-tip"
          d="M31 51 C43 47 58 56 60 69 C62 83 50 92 25 97 C17 99 12 92 16 85 C20 78 16 72 18 64 C19 58 24 54 31 51 Z"
        />
        <path
          data-part="paint-stroke"
          d="M9 88 C21 80 32 91 44 90 C57 89 64 79 76 82 C83 83 88 87 92 91"
          fill="none"
          stroke="#fff"
          strokeWidth="10"
          strokeLinecap="round"
        />
      </>
    )
  }
  if (activity === 'running') {
    return (
      <>
        <rect data-part="terminal" x="4" y="17" width="92" height="66" rx="28" />
        <path
          data-part="terminal-prompt"
          d="M23 35 L37 50 L23 65"
          fill="none"
          stroke="#000"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          data-part="terminal-cursor"
          d="M50 61 H65"
          fill="none"
          stroke="#000"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <circle data-part="terminal-command-one" cx="51" cy="42" r="4.5" fill="#000" />
        <circle data-part="terminal-command-two" cx="65" cy="42" r="4.5" fill="#000" />
        <circle data-part="terminal-command-three" cx="79" cy="42" r="4.5" fill="#000" />
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
