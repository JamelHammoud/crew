import { create } from 'zustand'
import {
  cleanSettings,
  defaultSettings,
  LONGEST_MS,
  rulesOf,
  type ScribeSettings
} from '../../../shared/scribe'
import { tidy, type ScribeChunk } from '../../../shared/scribeTidy'
import { ScribeTake } from '../media/scribe/take'
import { trim } from '../media/scribe/trim'
import { HEARD_RATE } from '../media/voice/gate'
import { VoiceListener } from '../media/voice/listener'
import { progressOf, type Fetching } from '../media/voice/models'

// off      nothing is happening
// waking   the model is being fetched, the first time only
// arming   the key is down and the microphone is opening
// hearing  it is listening
// reading  the key is up and whisper is finishing
// failed   something went wrong and the sound is still here
export type ScribePhase = 'off' | 'waking' | 'arming' | 'hearing' | 'reading' | 'failed'

export interface ScribeState {
  phase: ScribePhase
  progress: number
  problem: string | null
  settings: ScribeSettings
  arm: () => Promise<void>
  finish: () => Promise<void>
  cancel: () => void
  apply: (settings: ScribeSettings) => void
  said: (problem: string | null) => void
}

// The bars are read off real audio every frame, so the take is held out here
// rather than in state, the way the voice conversation holds its ear.
let live: ScribeTake | null = null

export function scribeAnalyser(): AnalyserNode | null {
  return live?.analyser ?? null
}

const platform = (): string =>
  globalThis.navigator?.platform?.toLowerCase().includes('mac') ? 'darwin' : 'win32'

export const useScribe = create<ScribeState>((set, get) => {
  const fetching = new Map<string, Fetching>()
  // Every piece of the dictation that has been sent to whisper, in the order it
  // was spoken. A long one is nearly read by the time the key is let go, which
  // is the whole reason the take hands pieces over while somebody is still
  // talking.
  let pieces: Array<Promise<ScribeChunk[]>> = []
  let capped: ReturnType<typeof setTimeout> | undefined
  let loading = false

  const listener = new VoiceListener({
    onFetching: (file, loaded, total) => {
      fetching.set(file, { file, loaded, total })
      if (get().phase === 'waking') set({ progress: progressOf(fetching) })
    },
    onReady: () => {
      loading = false
      if (get().phase === 'waking') set({ phase: 'off', progress: 1 })
    },
    onFailed: message => set({ phase: 'failed', problem: message })
  })

  // Shifted onto the take's own clock, because whisper times every piece from
  // the front of whatever it was handed and the gaps between pieces are what
  // the marks are placed from.
  const read = async (audio: Float32Array, at: number): Promise<ScribeChunk[]> => {
    const heard = await listener.hear(audio)
    if (!heard) throw new Error('listener')
    return heard.chunks.map(chunk => ({
      text: chunk.text,
      start: chunk.start + at,
      end: chunk.end + at
    }))
  }

  const take = new ScribeTake({
    onPiece: (audio, at) => {
      const { audio: spoken, spoke } = trim(audio, HEARD_RATE)
      if (!spoke) return
      pieces.push(read(spoken, at))
    }
  })

  live = take

  const stop = () => {
    clearTimeout(capped)
    take.close()
    live = take
  }

  const drop = () => {
    stop()
    pieces = []
    listener.forget()
  }

  return {
    phase: 'off',
    progress: 0,
    problem: null,
    settings: defaultSettings(platform()),

    arm: async () => {
      if (get().phase !== 'off' && get().phase !== 'failed') return
      pieces = []
      set({ phase: 'arming', problem: null })
      const problem = await take.start()
      if (get().phase !== 'arming') return take.close()
      if (problem) {
        set({
          phase: 'failed',
          problem: 'Crew could not reach your microphone. Check its permission in System Settings.'
        })
        return
      }
      // A key somebody latched on and walked away from. It ends itself rather
      // than recording the room until the app is quit.
      capped = setTimeout(() => void get().finish(), LONGEST_MS)
      set({ phase: 'hearing' })
    },

    finish: async () => {
      const phase = get().phase
      if (phase !== 'hearing' && phase !== 'arming') return
      set({ phase: 'reading' })
      const rest = take.rest()
      stop()
      const { audio, spoke } = trim(rest.audio, HEARD_RATE)
      const waiting = [...pieces, ...(spoke ? [read(audio, rest.at)] : [])]
      pieces = []
      try {
        const chunks = (await Promise.all(waiting)).flat()
        if (get().phase !== 'reading') return
        const text = tidy(chunks, rulesOf(get().settings))
        set({ phase: 'off', problem: null })
        window.crew.scribeDone(text)
      } catch {
        // A listener that fell over and a room that said nothing are the same
        // empty answer, so the one that failed says so and keeps the sound,
        // rather than reading as a key that quietly does nothing.
        if (get().phase !== 'reading') return
        set({ phase: 'failed', problem: 'Crew could not read that.' })
      }
    },

    cancel: () => {
      drop()
      set({ phase: 'off', problem: null })
      window.crew.dismissScribe()
    },

    apply: settings => {
      const clean = cleanSettings(settings, platform())
      set({ settings: clean })
      // The model is fetched the moment dictation is turned on rather than the
      // first time the key is pressed, so nobody's first sentence waits on a
      // download.
      if (!clean.on || loading) return
      loading = true
      if (get().phase === 'off') set({ phase: 'waking', progress: progressOf(fetching) })
      listener.load()
    },

    said: problem => {
      if (!problem) return
      set({ phase: 'failed', problem })
    }
  }
})
