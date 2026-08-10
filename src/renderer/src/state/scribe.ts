import { create } from 'zustand'
import {
  cleanSettings,
  defaultSettings,
  editorOf,
  LONGEST_MS,
  rulesOf,
  type ScribeSettings
} from '../../../shared/scribe'
import { editSaid } from '../../../shared/scribeEdit'
import { ScribeFlow } from '../../../shared/scribeLive'
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
  // What was said with nothing to say it into. Main is what decides this and what
  // holds the words, so the pill is told rather than working it out: the caret
  // belongs to another application and the clipboard belongs to the machine, and
  // this window can reach neither.
  held: string
  settings: ScribeSettings
  arm: () => Promise<void>
  finish: () => Promise<void>
  retry: () => Promise<void>
  cancel: () => void
  // Whether there is still sound here worth reading again, which is what tells a
  // failure that can be tried from one that cannot.
  keeping: () => boolean
  apply: (settings: ScribeSettings) => void
  said: (problem: string | null) => void
  holding: (text: string) => void
  copy: () => void
  letGo: () => void
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
  // Every piece of the dictation that has been sent to whisper and not yet
  // landed, in the order it was spoken. A long one is nearly read by the time the
  // key is let go, which is the whole reason the take hands pieces over while
  // somebody is still talking.
  let pieces: Array<Promise<ScribeChunk[]>> = []
  // The sound those pieces were read from, kept until they have landed. A
  // reading that fell over must not cost somebody the sentence they said, so
  // trying again costs one press rather than saying the whole thing over.
  let held: Array<{ audio: Float32Array; at: number }> = []
  let capped: ReturnType<typeof setTimeout> | undefined
  let loading = false
  // Writing as it is said. `flow` is the rule and `walking` is the one walk down
  // the pieces, in order, so two stretches can never land the wrong way round
  // however they were read.
  const flow = new ScribeFlow()
  let walking: Promise<void> = Promise.resolve()

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
  // A copy goes to the worker rather than the sound itself, because handing over
  // a buffer empties the one here. Kept, the same seconds can be read again.
  const read = async (audio: Float32Array, at: number): Promise<ScribeChunk[]> => {
    const heard = await listener.hear(audio.slice())
    if (!heard) throw new Error('listener')
    return heard.chunks.map(chunk => ({
      text: chunk.text,
      start: chunk.start + at,
      end: chunk.end + at
    }))
  }

  // Written as it is said, which is only ever a paste. A dictation that goes to
  // the clipboard has one place to land and lands there once.
  const asSaid = (): boolean => get().settings.live && get().settings.finish === 'paste'

  const written = (chunks: readonly ScribeChunk[]): Promise<string> => {
    const settings = get().settings
    return editSaid(tidy(chunks, rulesOf(settings)), editorOf(settings))
  }

  const keep = (audio: Float32Array, at: number) => {
    held.push({ audio, at })
    pieces.push(read(audio, at))
    if (asSaid()) void walk()
  }

  // One stretch at a time, in the order it was spoken, each one written the
  // moment it has been read. A stretch that has gone is off both lists, so what
  // is left is what a failure still has to answer for.
  const walk = (): Promise<void> => {
    walking = walking.then(async () => {
      while (pieces.length > 0) {
        const first = pieces[0]
        let chunks: ScribeChunk[]
        try {
          chunks = await first
        } catch {
          // Whisper fell over. Nothing here can take back what is already on
          // somebody's screen, so the take ends and what has not been written is
          // kept: trying again writes the rest rather than the whole of it.
          if (pieces[0] !== first) return
          stop()
          set({ phase: 'failed', problem: 'Crew could not read that.' })
          return
        }
        // The dictation this stretch belonged to is over, or was thrown away.
        if (pieces[0] !== first) return
        pieces.shift()
        held.shift()
        const said = await written(chunks)
        if (get().phase !== 'reading' && get().phase !== 'hearing') return
        const text = flow.mark(said)
        if (text) window.crew.scribeWrite(text)
      }
    })
    return walking
  }

  // The end of one that was written as it was said. Everything left is written,
  // and then the pill is told it is over with nothing to hand over: the words
  // are already where they were going.
  const settle = async () => {
    await walk()
    if (get().phase !== 'reading') return
    set({ phase: 'off', problem: null })
    window.crew.scribeDone('')
  }

  const take = new ScribeTake({
    onPiece: (audio, at) => {
      const { audio: spoken, spoke } = trim(audio, HEARD_RATE)
      if (spoke) keep(spoken, at)
    }
  })

  live = take

  // A machine that has chosen to live with its recording light on keeps the
  // device, and only the keeping stops. Everywhere else the microphone really
  // closes, so nothing is open between dictations.
  const stop = () => {
    clearTimeout(capped)
    take.record(false)
    if (!get().settings.ready) take.close()
  }

  // A walk still waiting on a read it will never be told about is left where it
  // is rather than cancelled. It comes back to a list that is not the one it set
  // out down and stands itself down, and the next dictation walks on its own.
  const clear = () => {
    pieces = []
    held = []
    flow.reset()
    walking = Promise.resolve()
  }

  const drop = () => {
    stop()
    clear()
    listener.forget()
  }

  const land = async (waiting: Array<Promise<ScribeChunk[]>>) => {
    try {
      const chunks = (await Promise.all(waiting)).flat()
      if (get().phase !== 'reading') return
      const text = await written(chunks)
      if (get().phase !== 'reading') return
      held = []
      set({ phase: 'off', problem: null })
      window.crew.scribeDone(text)
    } catch {
      // A listener that fell over and a room that said nothing are the same
      // empty answer, so the one that failed says so and keeps the sound,
      // rather than reading as a key that quietly does nothing.
      if (get().phase !== 'reading') return
      set({ phase: 'failed', problem: 'Crew could not read that.' })
    }
  }

  return {
    phase: 'off',
    progress: 0,
    problem: null,
    held: '',
    settings: defaultSettings(platform()),

    // A press while the model is still coming down still records. Whisper is
    // asked for the words either way and answers once it is here, which costs
    // the first dictation a wait and loses none of it.
    arm: async () => {
      const phase = get().phase
      if (phase !== 'off' && phase !== 'failed' && phase !== 'waking') return
      clear()
      set({ phase: 'arming', problem: null })
      const problem = take.listening ? null : await take.start()
      if (get().phase !== 'arming') return take.close()
      if (problem) {
        set({
          phase: 'failed',
          problem: 'Crew could not reach your microphone. Check its permission in System Settings.'
        })
        return
      }
      take.record(true)
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
      if (spoke) keep(audio, rest.at)
      if (asSaid()) return settle()
      const waiting = pieces
      pieces = []
      await land(waiting)
    },

    // The same sound, read again. Nothing is recorded twice and nothing is
    // spoken twice, and what was already written is not written again: only
    // what never landed is still here to try.
    retry: async () => {
      if (get().phase !== 'failed' || held.length === 0) return
      set({ phase: 'reading', problem: null })
      const waiting = held.map(one => read(one.audio, one.at))
      if (!asSaid()) return land(waiting)
      pieces = waiting
      await settle()
    },

    cancel: () => {
      drop()
      set({ phase: 'off', problem: null })
      window.crew.dismissScribe()
    },

    keeping: () => held.length > 0,

    apply: settings => {
      const clean = cleanSettings(settings, platform())
      set({ settings: clean })
      const idle = get().phase === 'off' || get().phase === 'waking'
      if (clean.on && clean.ready && !take.listening) void take.start()
      else if ((!clean.on || !clean.ready) && idle && take.listening) take.close()
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
    },

    holding: text => set({ held: text }),

    // Nothing is said back about either of these. The card is the whole of what
    // is on screen, so a word about the copy would be a word written over the
    // words it is about, and letting go takes the card down, which says it.
    copy: () => window.crew.copyScribeHeld(),

    letGo: () => window.crew.letGoScribeHeld()
  }
})
