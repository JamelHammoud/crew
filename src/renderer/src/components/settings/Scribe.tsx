import { useEffect, useState } from 'react'
import {
  fallbackLabel,
  keyLabel,
  scribeKeys,
  WORD_LIMIT,
  type ScribeKey,
  type ScribeKeyState,
  type ScribeSettings,
  type ScribeWord
} from '../../../../shared/scribe'
import { editModels } from '../../../../shared/scribeEdit'
import type { Said } from '../../../../shared/scribeSaid'
import { CloseGlyph, PlusGlyph, WarningGlyph } from '../../icons'
import { forgetSaid, useScribeSaid } from '../../state/scribeSaid'
import { setScribeSettings, useScribeSettings } from '../../state/scribeSettings'
import CopyButton from '../CopyButton'
import Pill from '../Pill'
import Select from '../Select'
import TextField from '../TextField'
import { formatShortDay, formatTime } from '../time'
import Toggle from '../Toggle'
import { Action, Page, Quiet, Row, Section } from './parts'

const PRESSES = [
  { value: 'latch', label: 'Hold it, or tap to keep going' },
  { value: 'hold', label: 'Hold it down' },
  { value: 'toggle', label: 'Press to start, press to stop' }
]

const FINISHES = [
  { value: 'paste', label: 'Paste it' },
  { value: 'copy', label: 'Copy it' }
]

const isMac = (): boolean => Boolean(globalThis.navigator?.platform?.toLowerCase().includes('mac'))

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
            placeholder="What comes out"
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

// Today it is the time of day, and anything older is the day itself. A dictation
// from an hour ago and one from last week are found in different ways, and
// carrying both on every row would be two figures where one is doing the work.
const when = (at: number): string => {
  const day = formatShortDay(at)
  return day === 'Today' ? formatTime(at) : day
}

// The last few dictations, newest first, each one a press away from the
// clipboard. The words are the row: they are what somebody said, so they are
// selectable, and they are cut off after two lines rather than turning the page
// into a transcript.
function Recent({ said }: { said: Said[] }) {
  if (said.length === 0) return <p className="text-sm text-fg/45 py-2">Nothing yet.</p>
  return (
    <div>
      {said.map(one => (
        <div key={one.id} className="flex items-start gap-3 py-1.5 border-b border-fg/[0.06] last:border-b-0">
          <p className="flex-1 min-w-0 pt-1.5 text-sm text-fg/70 leading-snug line-clamp-2 select-text">{one.text}</p>
          <span className="shrink-0 pt-1.5 text-xs text-fg/45">{when(one.at)}</span>
          <CopyButton glass text={one.text} />
        </div>
      ))}
    </div>
  )
}

function Editing({ settings }: { settings: ScribeSettings }) {
  const [address, setAddress] = useState(settings.editUrl)
  const [models, setModels] = useState<string[] | null>(null)

  useEffect(() => setAddress(settings.editUrl), [settings.editUrl])

  useEffect(() => {
    let live = true
    setModels(null)
    void editModels(settings.editUrl).then(found => live && setModels(found))
    return () => {
      live = false
    }
  }, [settings.editUrl])

  const settle = () => {
    if (address.trim() !== settings.editUrl) setScribeSettings({ editUrl: address })
  }

  return (
    <>
      <Row label="Server">
        <TextField
          glass
          value={address}
          placeholder="Address"
          onChange={event => setAddress(event.target.value)}
          onBlur={settle}
          onKeyDown={event => event.key === 'Enter' && settle()}
        />
      </Row>
      {models !== null && models.length === 0 ? (
        <Row label="Nothing answered there" line="Start it and the models turn up here.">
          <WarningGlyph className="w-5 h-5 text-danger" />
        </Row>
      ) : (
        <Row label="Model">
          <Select
            value={settings.editModel}
            options={(models ?? [settings.editModel].filter(Boolean)).map(model => ({
              value: model,
              label: model
            }))}
            onChange={editModel => setScribeSettings({ editModel })}
          />
        </Row>
      )}
    </>
  )
}

function Trouble({ state }: { state: ScribeKeyState }) {
  if (!state.trusted) {
    return (
      <Row label="Accessibility is off" line="Dictation does nothing until it is on.">
        <Action label="Open Settings" onClick={() => void window.crew.openScribePermission()} />
      </Row>
    )
  }
  if (state.hooked) return null
  return (
    <Row label="Your key is not working" line={`Press ${fallbackLabel(platform())} instead.`}>
      <WarningGlyph className="w-5 h-5 text-danger" />
    </Row>
  )
}

export default function Scribe() {
  const settings = useScribeSettings()
  const said = useScribeSaid()
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
        <Row label="Dictation" line="Nothing you say leaves this machine.">
          <Toggle on={settings.on} label="Dictation" onChange={on => setScribeSettings({ on })} />
        </Row>
        <Row label="Keep Scribe on screen" line="It waits where you left it.">
          <Toggle
            on={settings.always}
            label="Keep Scribe on screen"
            onChange={always => setScribeSettings({ always })}
          />
        </Row>
      </Section>

      <Section title="Recently said" action={said.length > 0 && <Quiet label="Clear" onClick={() => forgetSaid()} />}>
        <Recent said={said} />
      </Section>

      <Section title="The key">
        <Row label="Which one">
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
        <Row label="Fillers" line="Um, uh, you know.">
          <Toggle on={settings.fillers} label="Fillers" onChange={fillers => setScribeSettings({ fillers })} />
        </Row>
        <Row label="Stutters">
          <Toggle on={settings.stutters} label="Stutters" onChange={stutters => setScribeSettings({ stutters })} />
        </Row>
        <Row label="Corrections" line="Say scratch that and the sentence before it goes.">
          <Toggle
            on={settings.corrections}
            label="Corrections"
            onChange={corrections => setScribeSettings({ corrections })}
          />
        </Row>
        <Row label="Punctuation">
          <Toggle on={settings.marks} label="Punctuation" onChange={marks => setScribeSettings({ marks })} />
        </Row>
      </Section>

      <Section title="Writing it up">
        <Row
          label="Use a model on this computer"
          line="Sentences come out whole, and times and amounts are written properly."
        >
          <Toggle
            on={settings.edit}
            label="Use a model on this computer"
            onChange={edit => setScribeSettings({ edit })}
          />
        </Row>
        {settings.edit && <Editing settings={settings} />}
      </Section>

      <Section title="Finishing">
        <Row label="When you are done">
          <Select
            value={settings.finish}
            options={FINISHES}
            onChange={finish => setScribeSettings({ finish: finish as 'paste' | 'copy' })}
          />
        </Row>
        {/* Left out rather than greyed where there is nowhere for it to happen.
            A dictation on its way to the clipboard has one place to land and
            lands there once. */}
        {settings.finish === 'paste' && (
          <Row label="Write as you talk">
            <Toggle on={settings.live} label="Write as you talk" onChange={live => setScribeSettings({ live })} />
          </Row>
        )}
        <Row
          label="Keep the microphone ready"
          line="Your first word is never cut off, and your recording light stays on."
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
