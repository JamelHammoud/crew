import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { agentsHere } from '../../design/askAgent'
import { CheckGlyph, CloseGlyph, MicGlyph, MicOffGlyph, SpeakerGlyph } from '../../icons'
import { SPEAK_VOICES } from '../../media/voice/models'
import { useCrew } from '../../state/store'
import { useVoice } from '../../state/voice'
import AgentIcon from '../AgentIcon'
import { MenuItem, Popover } from '../Popover'
import Tooltip from '../Tooltip'
import VoiceCards from './VoiceCards'
import VoiceOrb from './VoiceOrb'

// What a conversation is doing, in the fewest words that say it. It is under
// the orb rather than on it, and it goes as soon as there is something better
// to put there, which is whatever was just said.
const SAYING: Record<string, string> = {
  waking: 'Getting ready',
  listening: 'Listening',
  hearing: 'Listening',
  thinking: 'Working'
}

function Round({
  label,
  on,
  danger,
  disabled,
  onClick,
  children
}: {
  label: string
  on?: boolean
  danger?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  const skin = danger
    ? 'bg-danger text-white hover:bg-danger/90'
    : on
      ? 'bg-fg text-ink-900 hover:bg-fg/90'
      : 'bg-fg/10 text-fg hover:bg-fg/20'
  return (
    <Tooltip label={label}>
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95 disabled:opacity-40 ${skin}`}
      >
        {children}
      </button>
    </Tooltip>
  )
}

function VoicePicker() {
  const [open, setOpen] = useState(false)
  const picked = useVoice(s => s.voice)
  const pickVoice = useVoice(s => s.pickVoice)
  return (
    <span className="relative flex">
      <Tooltip label="Voice" disabled={open}>
        <button
          onClick={() => setOpen(v => !v)}
          aria-label="Voice"
          aria-expanded={open}
          className="w-14 h-14 rounded-full bg-fg/10 text-fg flex items-center justify-center transition-all duration-150 hover:bg-fg/20 active:scale-95"
        >
          <SpeakerGlyph className="w-6 h-6" />
        </button>
      </Tooltip>
      <Popover open={open} onClose={() => setOpen(false)} side="top" align="center" className="w-52">
        {SPEAK_VOICES.map(voice => (
          <MenuItem
            key={voice.id}
            label={voice.name}
            hint={voice.accent}
            checked={voice.id === picked}
            onClick={() => {
              pickVoice(voice.id)
              setOpen(false)
            }}
          />
        ))}
      </Popover>
    </span>
  )
}

function Who() {
  const agentId = useVoice(s => s.agentId)
  const pickAgent = useVoice(s => s.pickAgent)
  const agents = useCrew(s => s.agents)
  const [open, setOpen] = useState(false)
  const here = agentsHere(agents)
  const agent = agents.find(one => one.id === agentId)
  if (!agent) return null
  return (
    <span className="relative flex">
      <Tooltip label="Talk to somebody else" disabled={open}>
        <button
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          className="h-10 pl-1.5 pr-4 rounded-full bg-ink-800 flex items-center gap-2.5 transition-colors duration-150 hover:bg-ink-700"
        >
          <AgentIcon seed={agent.id} size={28} />
          <span className="text-sm font-semibold text-fg">{agent.label}</span>
        </button>
      </Tooltip>
      <Popover open={open} onClose={() => setOpen(false)} align="start" className="w-56">
        {here.map(one => (
          <MenuItem
            key={one.id}
            icon={<AgentIcon seed={one.id} size={20} />}
            label={one.label}
            checked={one.id === agentId}
            onClick={() => {
              pickAgent(one.id)
              setOpen(false)
            }}
          />
        ))}
      </Popover>
    </span>
  )
}

export default function VoiceScreen() {
  const open = useVoice(s => s.open)
  const phase = useVoice(s => s.phase)
  const heard = useVoice(s => s.heard)
  const saying = useVoice(s => s.saying)
  const cards = useVoice(s => s.cards)
  const muted = useVoice(s => s.muted)
  const problem = useVoice(s => s.problem)
  const threadId = useVoice(s => s.threadId)
  const end = useVoice(s => s.end)
  const toggleMute = useVoice(s => s.toggleMute)
  const answer = useVoice(s => s.answer)
  const openThread = useCrew(s => s.openThread)

  useEffect(() => {
    if (!open) return
    const keys = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      end()
    }
    window.addEventListener('keydown', keys, true)
    return () => window.removeEventListener('keydown', keys, true)
  }, [open, end])

  if (!open) return null

  // The caption is one line and it is whoever is talking. The agent's own words
  // win while they are coming out, because that is what is being listened to.
  const caption = saying || (phase === 'thinking' || phase === 'hearing' ? heard : '') || ''
  const standing = SAYING[phase] ?? ''
  const roomy = cards.length === 0

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-ink-900 flex flex-col animate-pop">
      <div className="app-drag h-14 shrink-0 flex items-center justify-between px-4 mac:pl-[64px]">
        <div className="app-no-drag flex items-center gap-2">
          <Who />
          {threadId && (
            <button
              onClick={() => {
                end()
                openThread(threadId)
              }}
              className="h-10 px-4 rounded-full text-sm font-semibold text-fg-muted transition-colors duration-150 hover:text-fg"
            >
              Read it
            </button>
          )}
        </div>
        <div className="app-no-drag">
          <Tooltip label="Close">
            <button
              onClick={end}
              aria-label="Close"
              className="w-10 h-10 rounded-full bg-ink-800 text-fg-secondary flex items-center justify-center transition-all duration-150 hover:bg-ink-700 hover:text-fg active:scale-95"
            >
              <CloseGlyph className="w-5 h-5" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6">
        <div className="min-h-full max-w-[520px] mx-auto flex flex-col items-center justify-center gap-6 py-6">
          <VoiceOrb
            className={`w-full shrink-0 transition-[height] duration-500 ${roomy ? 'h-[340px]' : 'h-[180px]'}`}
          />
          {problem ? (
            <p className="text-base text-danger text-center max-w-[380px]">{problem}</p>
          ) : caption ? (
            <p
              className={`text-center max-w-[440px] ${saying ? 'text-lg text-fg' : 'text-base text-fg-muted italic'}`}
            >
              {caption}
            </p>
          ) : (
            <p className="text-base text-fg-faint">{standing}</p>
          )}
          <VoiceCards cards={cards} onPick={answer} />
        </div>
      </div>

      <div className="shrink-0 flex items-center justify-center gap-3 pb-10 pt-2">
        <Round label={muted ? 'Unmute' : 'Mute'} on={muted} onClick={toggleMute}>
          {muted ? <MicOffGlyph className="w-6 h-6" /> : <MicGlyph className="w-6 h-6" />}
        </Round>
        <VoicePicker />
        <Round label="Done" danger onClick={end}>
          <CheckGlyph className="w-6 h-6" />
        </Round>
      </div>
    </div>,
    document.body
  )
}
