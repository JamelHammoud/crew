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
            d="M17 50 C24 47 32 48 38 51"
            fill="none"
            stroke="#000"
            strokeWidth="6.5"
            strokeLinecap="round"
          />
          <path
            data-part="book-line-two"
            d="M17 63 C24 60 32 61 38 64"
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
            d="M62 51 C68 48 76 47 83 50"
            fill="none"
            stroke="#000"
            strokeWidth="6.5"
            strokeLinecap="round"
          />
          <path
            data-part="book-line-four"
            d="M62 64 C68 61 76 60 83 63"
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
      <g data-part="search-mark">
        <path
          data-part="search-handle"
          d="M56 56 L77 77"
          fill="none"
          stroke="#fff"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <g data-part="search-lens">
          <circle data-part="search-ring" cx="39" cy="38" r="26.5" />
          <circle data-part="search-hole" cx="39" cy="38" r="15.5" fill="#000" />
        </g>
      </g>
    )
  }
  if (activity === 'editing') {
    return (
      <>
        <g data-part="writing-pencil">
          <path
            data-part="writing-pencil-body"
            d="M15 81 L23 59 L67 15 C73 9 81 9 87 15 C93 21 93 29 87 35 L43 79 L21 91 C15 94 10 87 15 81 Z"
          />
          <path
            data-part="writing-pencil-seam"
            d="M23 59 L43 79 M64 18 L84 38"
            fill="none"
            stroke="#000"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <circle data-part="writing-pencil-point" cx="18" cy="86" r="4" fill="#000" />
        </g>
        <path
          data-part="writing-trail"
          d="M38 89 C54 84 72 93 89 86"
          fill="none"
          stroke="#fff"
          strokeWidth="9"
          strokeLinecap="round"
        />
      </>
    )
  }
  if (activity === 'designing') {
    return (
      <>
        <path
          data-part="design-palette"
          d="M49 5 C75 5 94 21 96 43 C98 59 88 70 73 70 H66 C61 70 59 74 61 79 C65 89 58 96 45 95 C21 94 5 78 4 55 C3 28 22 6 49 5 Z"
        />
        <circle data-part="design-color-one" cx="29" cy="32" r="7" fill="#000" />
        <circle data-part="design-color-two" cx="51" cy="22" r="7" fill="#000" />
        <circle data-part="design-color-three" cx="72" cy="34" r="7" fill="#000" />
        <ellipse data-part="design-thumb" cx="33" cy="64" rx="10" ry="9" fill="#000" />
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
        <rect data-part="plan-board" x="13" y="7" width="74" height="87" rx="22" />
        <path
          data-part="plan-check-one"
          d="M27 42 L34 49 L44 35"
          fill="none"
          stroke="#000"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          data-part="plan-line-one"
          d="M55 42 H72"
          fill="none"
          stroke="#000"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          data-part="plan-check-two"
          d="M27 68 L34 75 L44 61"
          fill="none"
          stroke="#000"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          data-part="plan-line-two"
          d="M55 68 H72"
          fill="none"
          stroke="#000"
          strokeWidth="8"
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
          d="M18 12 H82 C91 12 96 19 96 28 V55 C96 64 89 71 80 71 H54 L31 88 C26 92 20 87 23 80 L28 71 H18 C9 71 4 64 4 55 V28 C4 19 9 12 18 12 Z"
        />
        <circle data-part="message-dot-one" cx="30" cy="42" r="6" fill="#000" />
        <circle data-part="message-dot-two" cx="50" cy="42" r="6" fill="#000" />
        <circle data-part="message-dot-three" cx="70" cy="42" r="6" fill="#000" />
      </>
    )
  }
  return (
    <>
      <path
        data-part="action-bolt"
        d="M54 4 C59 3 62 7 61 12 L57 39 H78 C85 39 88 47 83 52 L46 96 C42 100 35 96 37 90 L44 61 H21 C14 61 11 53 16 48 L54 4 Z"
      />
      <circle data-part="action-spark-one" cx="18" cy="22" r="7" />
      <circle data-part="action-spark-two" cx="84" cy="76" r="6" />
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
