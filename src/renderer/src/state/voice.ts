import { create } from 'zustand'
import type { VoiceCard } from '../../../shared/voice'
import { VoiceReply } from '../../../shared/voiceReply'
import { agentsHere, agentToAsk } from '../design/askAgent'
import { VoiceEar } from '../media/voice/ear'
import { VoiceListener } from '../media/voice/listener'
import { progressOf, rememberVoice, storedVoice, type Fetching } from '../media/voice/models'
import { VoiceMouth } from '../media/voice/mouth'
import { endOf, findTurn, textOf, worthSending } from '../media/voice/turn'
import { playSound } from '../media/sounds'
import { useCrew } from './store'

// off       nobody is talking
// waking    the two models are being fetched, the first time only
// listening the microphone is open and the room is quiet
// hearing   somebody is talking right now
// thinking  what they said has gone to the agent
// speaking  the answer is coming out of the speakers
export type VoicePhase = 'off' | 'waking' | 'listening' | 'hearing' | 'thinking' | 'speaking'

const AGENT_KEY = 'crew.voice.agent'

export interface VoiceState {
  open: boolean
  phase: VoicePhase
  agentId: string | null
  threadId: string | null
  progress: number
  // The last thing this machine heard somebody say, and the sentence coming
  // out of the speakers now. One caption each, because they are two people.
  heard: string
  saying: string
  cards: VoiceCard[]
  muted: boolean
  voice: string
  problem: string | null
  start: (agentId?: string) => Promise<void>
  end: () => void
  toggleMute: () => void
  pickVoice: (id: string) => void
  pickAgent: (agentId: string) => void
  answer: (text: string) => void
  clearProblem: () => void
}

const REST = {
  phase: 'off' as VoicePhase,
  threadId: null,
  progress: 0,
  heard: '',
  saying: '',
  cards: [] as VoiceCard[],
  problem: null
}

const storedAgent = (): string | null => globalThis.localStorage?.getItem(AGENT_KEY) ?? null

// The orb is drawn off whichever of the two is making the sound right now, so
// it is always reading real audio rather than a shape standing in for it. Held
// out here because the drawing runs every frame and must not go through state.
let live: { ear: VoiceEar; mouth: VoiceMouth } | null = null

export function voiceAnalyser(): AnalyserNode | null {
  if (!live) return null
  return live.mouth.speaking ? live.mouth.analyser : live.ear.analyser
}

export const useVoice = create<VoiceState>((set, get) => {
  const fetching = new Map<string, Fetching>()
  let unwatch: (() => void) | null = null
  let promptId: string | null = null
  let reply: VoiceReply | null = null
  let asked: string | null = null
  let raw = ''
  let ready = 0

  const fetched = (file: string, loaded: number, total: number) => {
    fetching.set(file, { file, loaded, total })
    if (get().phase === 'waking') set({ progress: progressOf(fetching) })
  }

  // Both models have to be here before the microphone is worth opening. Two
  // downloads fill one ring, so it never jumps back to the start halfway.
  const woke = () => {
    ready++
    if (ready < 2 || get().phase !== 'waking') return
    set({ phase: 'listening', progress: 1 })
  }

  const listener = new VoiceListener({
    onFetching: fetched,
    onReady: woke,
    onFailed: message => get().phase !== 'off' && set({ problem: message })
  })

  const mouth = new VoiceMouth({
    onFetching: fetched,
    onReady: woke,
    // The gate asks for more while the agent is talking, because what echo
    // cancellation leaves in the microphone is the agent's own voice and the
    // gate cannot tell it from somebody cutting in. Loose here and the agent
    // talks itself to a stop on its own first sentence.
    onSaying: saying => {
      ear.guarded(true)
      set({ saying, phase: 'speaking' })
    },
    // Also from thinking, because a reply that was all card, or that had
    // nothing in it at all, goes quiet without ever having said a word. Read
    // as speaking only, that turn leaves the orb working forever.
    onQuiet: () => {
      const phase = get().phase
      if (phase === 'speaking' || phase === 'thinking') set({ phase: 'listening', saying: '' })
    },
    onFailed: message => get().phase !== 'off' && set({ problem: message })
  })

  const ear = new VoiceEar({
    onStart: () => {
      if (get().phase === 'off' || get().phase === 'waking') return
      // Cutting in stops the voice and nothing else. Whatever the agent is
      // doing to the project it goes on doing, because an interruption is
      // somebody talking over an answer, not somebody undoing work.
      if (mouth.speaking) {
        promptId = null
        reply = null
        mouth.stop()
      }
      set({ phase: 'hearing', saying: '' })
    },
    onEnd: audio => {
      if (audio) return void heard(audio)
      if (get().phase === 'hearing') set({ phase: 'listening' })
    }
  })

  live = { ear, mouth }

  const heard = async (audio: Float32Array) => {
    if (get().phase === 'off') return
    set({ phase: 'thinking' })
    const text = await listener.hear(audio)
    if (get().phase === 'off') return
    // A turn that fell over on the way in says so. Handed back as nothing it is
    // the same as a cough, and a conversation where every turn quietly failed
    // looks exactly like one nobody is answering.
    if (text === null) {
      set({ phase: 'listening', problem: 'crew could not make out what was said.' })
      return
    }
    if (!worthSending(text)) {
      set({ phase: 'listening' })
      return
    }
    set({ heard: text })
    send(text)
  }

  const send = (text: string) => {
    const { threadId, agentId } = get()
    if (!agentId) return
    asked = text
    promptId = null
    raw = ''
    reply = new VoiceReply()
    set({ phase: 'thinking', cards: [], saying: '' })
    mouth.open(get().voice)
    const crew = useCrew.getState()
    if (threadId) crew.sendChat(text, threadId)
    else crew.sendChat(text, undefined, undefined, undefined, [agentId], ['voice'])
  }

  const speak = (say: string, cards: VoiceCard[]) => {
    if (say) mouth.push(say)
    if (cards.length > 0) set(state => ({ cards: [...state.cards, ...cards] }))
  }

  const watch = () =>
    useCrew.subscribe(crew => {
      const state = get()
      if (state.phase === 'off' || !state.agentId) return
      if (!promptId && asked) {
        const turn = findTurn(crew.events, {
          byName: crew.selfName,
          agentId: state.agentId,
          text: asked,
          threadId: state.threadId
        })
        if (!turn) return
        promptId = turn.promptId
        if (!state.threadId) set({ threadId: turn.threadId })
      }
      if (!promptId || !reply) return
      const grown = textOf(crew.steps[promptId])
      if (grown.length > raw.length) {
        raw = grown
        const { say, cards } = reply.grew(raw)
        speak(say, cards)
      }
      const ended = endOf(crew.events, promptId)
      if (!ended) return
      // The last text step and the end of the run say the same thing, so the
      // one that reaches further is the whole of it. A run that failed says so
      // out loud rather than leaving the orb listening to nothing.
      const whole = ended.ok && ended.text.startsWith(raw) ? ended.text : raw
      const { say, cards } = reply.whole(whole || ended.text)
      speak(say, cards)
      if (!ended.ok && !say) mouth.push('That did not work.')
      promptId = null
      reply = null
      asked = null
      raw = ''
      mouth.seal()
      if (!mouth.speaking) set({ phase: 'listening' })
    })

  return {
    open: false,
    agentId: null,
    muted: false,
    voice: storedVoice(),
    ...REST,

    start: async agentId => {
      if (get().open) return
      const agents = useCrew.getState().agents
      const picked = agentToAsk(agents, agentId ?? storedAgent())
      if (!picked) {
        set({ open: true, ...REST, problem: 'No agent is here to talk to.' })
        return
      }
      playSound('join')
      set({ open: true, ...REST, agentId: picked.id, phase: 'waking', muted: false })
      fetching.clear()
      ready = 0
      unwatch = watch()
      listener.load()
      mouth.load()
      const problem = await ear.open()
      if (get().phase === 'off') return ear.close()
      if (problem) {
        set({ problem: 'crew could not reach your microphone. Check its permission in System Settings.' })
      }
    },

    end: () => {
      if (!get().open) return
      playSound('leave')
      unwatch?.()
      unwatch = null
      promptId = null
      reply = null
      asked = null
      raw = ''
      ear.close()
      mouth.stop()
      listener.forget()
      set({ open: false, ...REST })
    },

    toggleMute: () => {
      const muted = !get().muted
      ear.mute(muted)
      set({ muted })
      if (muted && get().phase === 'hearing') set({ phase: 'listening' })
    },

    pickVoice: id => {
      rememberVoice(id)
      set({ voice: id })
    },

    // Changing who you are talking to starts the conversation again, because a
    // thread belongs to one agent and half a conversation is not context.
    pickAgent: agentId => {
      if (agentId === get().agentId) return
      try {
        globalThis.localStorage?.setItem(AGENT_KEY, agentId)
      } catch {
        // Storage turned off keeps the choice for this conversation.
      }
      mouth.stop()
      promptId = null
      reply = null
      asked = null
      raw = ''
      set({ agentId, threadId: null, cards: [], heard: '', saying: '', phase: 'listening' })
    },

    // A tapped option, or anything typed. It goes in as a turn of its own, so
    // picking one off a card reads back the way saying it would have.
    answer: text => {
      const clean = text.trim()
      if (!clean || get().phase === 'off') return
      mouth.stop()
      set({ heard: clean })
      send(clean)
    },

    clearProblem: () => set({ problem: null })
  }
})

export const voiceAgents = agentsHere
