import { useId } from 'react'
import GeneratedField from './art/GeneratedField'
import { FIELD_LIGHT } from './art/pet'
import type { AgentActivity } from './agentActivity'

function ActivityShape({ activity }: { activity: Exclude<AgentActivity, 'idle'> }) {
  if (activity === 'thinking') {
    return (
      <>
        <g data-part="thought-cloud">
          <ellipse data-part="thought-core" cx="50" cy="49" rx="35" ry="25" />
          <circle data-part="thought-lobe-one" cx="50" cy="49" r="14.5" />
          <circle data-part="thought-lobe-two" cx="50" cy="49" r="14.5" />
          <circle data-part="thought-lobe-three" cx="50" cy="49" r="14.5" />
          <circle data-part="thought-lobe-four" cx="50" cy="49" r="14.5" />
          <circle data-part="thought-lobe-five" cx="50" cy="49" r="14.5" />
          <circle data-part="thought-lobe-six" cx="50" cy="49" r="14.5" />
          <circle data-part="thought-lobe-seven" cx="50" cy="49" r="14.5" />
        </g>
        <circle data-part="thought-dot-one" cx="31" cy="49" r="6.5" fill="#000" />
        <circle data-part="thought-dot-two" cx="50" cy="49" r="6.5" fill="#000" />
        <circle data-part="thought-dot-three" cx="69" cy="49" r="6.5" fill="#000" />
      </>
    )
  }
  if (activity === 'reading') {
    return (
      <>
        <g data-part="book-page-left">
          <path
            data-part="book-page-left-body"
            d="M42 31 C34 26 24 25 15 28 C11 29 8 33 8 38 V72 C8 77 12 80 17 79 C27 76 35 78 41 83 C44 85 46 82 46 78 V38 C46 35 45 33 42 31 Z"
          />
          <path
            data-part="book-line-one"
            d="M19 47 C26 44 34 45 40 48"
            fill="none"
            stroke="#000"
            strokeWidth="6.5"
            strokeLinecap="round"
          />
          <path
            data-part="book-line-two"
            d="M19 60 C26 57 34 58 40 61"
            fill="none"
            stroke="#000"
            strokeWidth="6.5"
            strokeLinecap="round"
          />
        </g>
        <g data-part="book-page-right">
          <path
            data-part="book-page-right-body"
            d="M58 31 C66 26 76 25 85 28 C89 29 92 33 92 38 V72 C92 77 88 80 83 79 C73 76 65 78 59 83 C56 85 54 82 54 78 V38 C54 35 55 33 58 31 Z"
          />
          <path
            data-part="book-line-three"
            d="M60 48 C66 45 74 44 81 47"
            fill="none"
            stroke="#000"
            strokeWidth="6.5"
            strokeLinecap="round"
          />
          <path
            data-part="book-line-four"
            d="M60 61 C66 58 74 57 81 60"
            fill="none"
            stroke="#000"
            strokeWidth="6.5"
            strokeLinecap="round"
          />
        </g>
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
        <path
          data-part="writing-line-one"
          d="M25 32 H63"
          fill="none"
          stroke="#000"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          data-part="writing-line-two"
          d="M25 51 H76"
          fill="none"
          stroke="#000"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          data-part="writing-line-three"
          d="M25 70 H55"
          fill="none"
          stroke="#000"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <circle data-part="writing-caret-one" cx="70" cy="32" r="5" fill="#000" />
        <circle data-part="writing-caret-two" cx="83" cy="51" r="5" fill="#000" />
        <circle data-part="writing-caret-three" cx="62" cy="70" r="5" fill="#000" />
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
        <rect data-part="terminal" x="4" y="17" width="92" height="66" rx="22" />
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
          d="M51 62 H72"
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
        <rect data-part="plan-row-one" x="5" y="8" width="90" height="25" rx="12.5" />
        <rect data-part="plan-row-two" x="5" y="38" width="90" height="25" rx="12.5" />
        <rect data-part="plan-row-three" x="5" y="68" width="90" height="25" rx="12.5" />
        <path
          data-part="plan-check-one"
          d="M18 20 L23 25 L31 15"
          fill="none"
          stroke="#000"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          data-part="plan-line-one"
          d="M40 21 H78"
          fill="none"
          stroke="#000"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          data-part="plan-check-two"
          d="M18 50 L23 55 L31 45"
          fill="none"
          stroke="#000"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          data-part="plan-line-two"
          d="M40 51 H72"
          fill="none"
          stroke="#000"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          data-part="plan-check-three"
          d="M18 80 L23 85 L31 75"
          fill="none"
          stroke="#000"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          data-part="plan-line-three"
          d="M40 81 H82"
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
          d="M17 13 H83 C92 13 97 20 97 29 V55 C97 64 90 71 81 71 H54 L32 87 C27 91 21 86 24 80 L28 71 H17 C8 71 3 64 3 55 V29 C3 20 8 13 17 13 Z"
        />
        <circle data-part="message-dot-one" cx="31" cy="42" r="6" fill="#000" />
        <circle data-part="message-dot-two" cx="50" cy="42" r="6" fill="#000" />
        <circle data-part="message-dot-three" cx="69" cy="42" r="6" fill="#000" />
      </>
    )
  }
  return (
    <>
      <g data-part="tool-gear">
        <circle cx="50" cy="50" r="31" />
        <circle cx="50" cy="13" r="11" />
        <circle cx="82" cy="31" r="11" />
        <circle cx="82" cy="69" r="11" />
        <circle cx="50" cy="87" r="11" />
        <circle cx="18" cy="69" r="11" />
        <circle cx="18" cy="31" r="11" />
        <circle data-part="tool-gear-hole" cx="50" cy="50" r="14" fill="#000" />
      </g>
      <circle data-part="tool-pulse" cx="50" cy="50" r="6" />
    </>
  )
}

export default function AgentActivityMark({
  activity,
  seed,
  box,
  motion = 'working'
}: {
  activity: Exclude<AgentActivity, 'idle'>
  seed: string
  box: number
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
              <GeneratedField seed={seed} box={box} light={FIELD_LIGHT} />
            </span>
          </foreignObject>
        </svg>
      </span>
    </span>
  )
}
