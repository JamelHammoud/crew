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
            d="M18 29 H67 C72 29 76 31 80 35 L92 46 C95 49 95 52 92 55 L80 66 C76 70 72 72 67 72 H18 C10 72 6 66 6 58 V43 C6 35 10 29 18 29 Z"
          />
          <path
            data-part="writing-pencil-seam"
            d="M72 35 L72 66"
            fill="none"
            stroke="#000"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <circle data-part="writing-pencil-point" cx="84" cy="50.5" r="4.5" fill="#000" />
        </g>
        <path
          data-part="writing-trail"
          d="M18 86 C37 80 57 91 82 84"
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
          data-part="design-nib"
          d="M50 5 C57 13 68 23 82 31 C90 36 92 45 87 53 L60 92 C55 99 45 99 40 92 L13 53 C8 45 10 36 18 31 C32 23 43 13 50 5 Z"
        />
        <circle data-part="design-aperture" cx="50" cy="49" r="9" fill="#000" />
        <path
          data-part="design-slit"
          d="M50 58 V89"
          fill="none"
          stroke="#000"
          strokeWidth="7"
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
        <rect data-part="plan-board" x="13" y="12" width="74" height="82" rx="22" />
        <rect data-part="plan-clip" x="34" y="5" width="32" height="18" rx="9" />
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
          data-part="message-back"
          d="M39 8 H79 C89 8 95 15 95 25 V47 C95 57 89 64 79 64 H74 L80 74 C83 79 77 84 72 80 L52 64 H39 C29 64 23 57 23 47 V25 C23 15 29 8 39 8 Z"
        />
        <path
          data-part="message-front"
          d="M17 35 H61 C71 35 77 42 77 52 V67 C77 77 71 84 61 84 H42 L25 96 C20 100 14 95 17 89 L20 84 H17 C7 84 1 77 1 67 V52 C1 42 7 35 17 35 Z"
        />
        <circle data-part="message-dot-one" cx="27" cy="60" r="6" fill="#000" />
        <circle data-part="message-dot-two" cx="49" cy="60" r="6" fill="#000" />
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
