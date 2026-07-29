import { playSound } from '../../media/sounds'
import type { InputKind } from '../../media/devices'
import { useHuddle } from '../../state/huddle'
import { useMusic } from '../../state/music'
import { setSounds, useSounds } from '../../state/sound'
import Select from '../Select'
import Slider from '../Slider'
import Toggle from '../Toggle'
import { useInputDevices } from '../huddle/useInputDevices'
import { Page, Row, Section } from './parts'

const NONE: Record<InputKind, string> = {
  microphone: 'Nothing to listen with yet.',
  camera: 'Nothing to see with yet.'
}

const FIX: Record<InputKind, string> = {
  microphone: 'Open microphone settings',
  camera: 'Open camera settings'
}

function Device({ kind, label }: { kind: InputKind; label: string }) {
  const devices = useInputDevices(kind, true)
  const chosen = useHuddle(s => (kind === 'microphone' ? s.micId : s.cameraId))
  const pickInput = useHuddle(s => s.pickInput)

  if (devices.length === 0) {
    return (
      <Row label={label} line={NONE[kind]}>
        <button
          onClick={() => void window.crew.openMediaSettings(kind)}
          className="text-sm text-fg/70 underline underline-offset-2 decoration-fg/30 transition-colors hover:text-fg hover:decoration-fg"
        >
          {FIX[kind]}
        </button>
      </Row>
    )
  }

  return (
    <Row label={label}>
      <div className="w-64">
        <Select
          full
          value={chosen ?? devices[0].id}
          options={devices.map(device => ({ value: device.id, label: device.name }))}
          onChange={id => void pickInput(kind, id)}
        />
      </div>
    </Row>
  )
}

export default function SoundAndVideo() {
  const sounds = useSounds()
  const volume = useMusic(s => s.volume)
  const muted = useMusic(s => s.muted)
  const setVolume = useMusic(s => s.setVolume)

  return (
    <Page title="Sound and video">
      <Section>
        <Row label="App sounds">
          <Toggle
            on={sounds}
            label="App sounds"
            onChange={on => {
              setSounds(on)
              if (on) playSound('sound.on')
            }}
          />
        </Row>
        <Row label="Music">
          <div className="w-64 flex items-center gap-3">
            <Slider value={muted ? 0 : volume} label="Music volume" onChange={setVolume} />
            <span className="w-8 shrink-0 text-right text-sm text-fg/45 tabular-nums">
              {Math.round((muted ? 0 : volume) * 100)}
            </span>
          </div>
        </Row>
      </Section>

      <Section title="In a huddle">
        <Device kind="microphone" label="Microphone" />
        <Device kind="camera" label="Camera" />
      </Section>
    </Page>
  )
}
