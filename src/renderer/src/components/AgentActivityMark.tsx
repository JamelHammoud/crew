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
        <path
          data-part="page-left"
          d="M9 22 C21 17 36 20 47 29 C49 31 50 34 50 37 V85 C38 77 24 75 11 80 C6 82 3 78 3 73 V31 C3 27 5 24 9 22 Z"
        />
        <path
          data-part="page-right"
          d="M91 22 C79 17 64 20 53 29 C51 31 50 34 50 37 V85 C62 77 76 75 89 80 C94 82 97 78 97 73 V31 C97 27 95 24 91 22 Z"
        />
        <path
          data-part="page-line-left"
          d="M17 39 C25 37 33 39 40 43"
          fill="none"
          stroke="#000"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          data-part="page-line-right"
          d="M60 43 C68 39 76 37 84 39"
          fill="none"
          stroke="#000"
          strokeWidth="6"
          strokeLinecap="round"
        />
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
          data-part="message-one"
          d="M19 10 H72 C82 10 89 18 89 28 V48 C89 58 81 66 71 66 H45 L29 77 C24 80 19 76 21 70 L22 66 H19 C9 66 3 58 3 48 V28 C3 18 9 10 19 10 Z"
        />
        <path
          data-part="message-two"
          d="M48 49 H81 C91 49 97 57 97 67 V76 C97 86 91 93 81 93 H77 L79 96 C81 99 77 102 73 99 L64 93 H48 C38 93 31 86 31 76 V67 C31 57 38 49 48 49 Z"
        />
        <circle data-part="message-dot-one" cx="28" cy="38" r="6" fill="#000" />
        <circle data-part="message-dot-two" cx="47" cy="38" r="6" fill="#000" />
        <circle data-part="message-dot-three" cx="66" cy="38" r="6" fill="#000" />
        <circle data-part="reply-dot" cx="65" cy="71" r="6" fill="#000" />
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
