import { useEffect, useState } from 'react'
import {
  fallbackLabel,
  keyLabel,
  scribeKeys,
  WORD_LIMIT,
  type ScribeKey,
  type ScribeKeyState,
  type ScribeWord
} from '../../../../shared/scribe'
import { CloseGlyph, PlusGlyph, WarningGlyph } from '../../icons'
import { setScribeSettings, useScribeSettings } from '../../state/scribeSettings'
import Pill from '../Pill'
import Select from '../Select'
import TextField from '../TextField'
import Toggle from '../Toggle'
import { Action, Page, Row, Section } from './parts'

const PRESSES = [
  { value: 'latch', label: 'Hold it, or tap to keep going' },
  { value: 'hold', label: 'Hold it down' },
  { value: 'toggle', label: 'Press to start, press to stop' }
]

const FINISHES = [
  { value: 'paste', label: 'Paste it' },
  { value: 'copy', label: 'Copy it' }
]

const isMac = (): boolean =>
  Boolean(globalThis.navigator?.platform?.toLowerCase().includes('mac'))

const platform = (): string => (isMac() ? 'darwin' : 'win32')

function Words({ words }: { words: ScribeWord[] }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const add = () => {
    if (!from.trim() || !to.trim()) return
    setScribeSettings({ words: [...words, { from: from.trim(), to: to.trim() }] })
    setFrom('')
    setTo('')
  }

  return (
    <div className="pt-1">
      {words.map((word, at) => (
        <div key={`${word.from}-${at}`} className="flex items-center gap-2 py-1.5">
          <p className="flex-1 min-w-0 truncate text-sm text-fg/45">{word.from}</p>
          <p className="flex-1 min-w-0 truncate text-sm text-fg">{word.to}</p>
          <button
            onClick={() => setScribeSettings({ words: words.filter((_, i) => i !== at) })}
            aria-label={`Remove ${word.from}`}
            className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-fg/45 transition-colors hover:text-fg hover:bg-fg/[0.07] active:scale-95"
          >
            <CloseGlyph className="w-4 h-4" />
          </button>
        </div>
      ))}
      {/* The way to add one stands at the end of the list rather than off in a
          corner, so it is the empty state and the way in both. */}
      {words.length < WORD_LIMIT && (
        <div className="flex items-center gap-2 py-1.5">
          <TextField
            glass
            value={from}
            placeholder="What it hears"
            onChange={event => setFrom(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && add()}
            className="flex-1 min-w-0"
          />
          <TextField
            glass
            value={to}
            placeholder="What you meant"
            onChange={event => setTo(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && add()}
            className="flex-1 min-w-0"
          />
          <button
            onClick={add}
            aria-label="Add word"
            disabled={!from.trim() || !to.trim()}
            className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-fg/45 transition-colors hover:text-fg hover:bg-fg/[0.07] active:scale-95 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <PlusGlyph className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

function Trouble({ state }: { state: ScribeKeyState }) {
  if (!state.trusted) {
    return (
      <Row
        label="Accessibility is off"
        line="Crew needs it to see the key at all, and to put the words where you are typing."
      >
        <Action label="Open Settings" onClick={() => void window.crew.openScribePermission()} />
      </Row>
    )
  }
  if (state.hooked) return null
  return (
    <Row
      label="The key is not being heard"
      line={`Use ${fallbackLabel(platform())} instead, which always works.`}
    >
      <WarningGlyph className="w-5 h-5 text-danger" />
    </Row>
  )
}

export default function Scribe() {
  const settings = useScribeSettings()
  const [state, setState] = useState<ScribeKeyState>({ hooked: true, trusted: true })

  useEffect(() => {
    let live = true
    const ask = () => void window.crew.scribeState().then(next => live && setState(next))
    ask()
    // Accessibility is granted outside the app, in a window Crew never sees, so
    // the state is asked for again rather than waiting on an event that is not
    // coming.
    const timer = setInterval(ask, 2000)
    return () => {
      live = false
      clearInterval(timer)
    }
  }, [])

  return (
    <Page title="Scribe">
      <Section>
        <Row
          label="Dictation"
          line="A small model comes down the first time, and stays on this machine."
        >
          <Toggle on={settings.on} label="Dictation" onChange={on => setScribeSettings({ on })} />
        </Row>
      </Section>

      <Section title="The key">
        <Row label="Which one" line={isMac() ? 'macOS keeps Fn to itself, so no app is given it.' : undefined}>
          <Select
            value={settings.key}
            options={scribeKeys(platform()).map(key => ({
              value: key,
              label: keyLabel(key, platform())
            }))}
            onChange={key => setScribeSettings({ key: key as ScribeKey })}
          />
        </Row>
        <Row label="Pressing it">
          <Select
            value={settings.press}
            options={PRESSES}
            onChange={press => setScribeSettings({ press: press as 'hold' | 'toggle' | 'latch' })}
          />
        </Row>
        <Row label="Or press">
          <Pill glass lg>
            {fallbackLabel(platform())}
          </Pill>
        </Row>
        {settings.on && <Trouble state={state} />}
      </Section>

      <Section title="Tidying">
        <Row label="Fillers" line="Um, uh, and a you know that is standing on its own.">
          <Toggle
            on={settings.fillers}
            label="Fillers"
            onChange={fillers => setScribeSettings({ fillers })}
          />
        </Row>
        <Row label="Stutters" line="A word said twice on the way to the next one.">
          <Toggle
            on={settings.stutters}
            label="Stutters"
            onChange={stutters => setScribeSettings({ stutters })}
          />
        </Row>
        <Row label="Corrections" line="Say scratch that and what you were saying goes with it.">
          <Toggle
            on={settings.corrections}
            label="Corrections"
            onChange={corrections => setScribeSettings({ corrections })}
          />
        </Row>
        <Row label="Punctuation" line="Marks and capitals, placed from how you said it.">
          <Toggle on={settings.marks} label="Punctuation" onChange={marks => setScribeSettings({ marks })} />
        </Row>
      </Section>

      <Section title="Finishing">
        <Row label="When you are done">
          <Select
            value={settings.finish}
            options={FINISHES}
            onChange={finish => setScribeSettings({ finish: finish as 'paste' | 'copy' })}
          />
        </Row>
        <Row
          label="Keep the microphone ready"
          line="The first word lands whole, and your recording light is on the whole time."
        >
          <Toggle
            on={settings.ready}
            label="Keep the microphone ready"
            onChange={ready => setScribeSettings({ ready })}
          />
        </Row>
      </Section>

      <Section title="Your words">
        <Words words={settings.words} />
      </Section>
    </Page>
  )
}
