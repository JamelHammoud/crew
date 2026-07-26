import { EyeIcon, EyeSlashIcon, MinusIcon, PlusIcon } from '@heroicons/react/16/solid'
import type { Layout, Stroke } from '../../../shared/designNode'
import Select from '../components/Select'
import Tooltip from '../components/Tooltip'
import EffectRow from './EffectRow'
import Typography from './Typography'
import { WeightGlyph } from './glyphs'
import { Choice, ColorInput, NumberInput, Row, Section, SubLabel } from './InspectorFields'
import type { NodeView } from './nodeView'

const DIRECTIONS = [
  { value: 'none', label: 'None' },
  { value: 'row', label: 'Row' },
  { value: 'column', label: 'Column' }
] as const

const ALIGNS = [
  { value: 'start', label: 'Start' },
  { value: 'center', label: 'Center' },
  { value: 'end', label: 'End' }
] as const

const JUSTIFIES = [...ALIGNS, { value: 'between', label: 'Space' }] as const

const STROKE_POSITIONS = [
  { value: 'inside', label: 'Inside' },
  { value: 'center', label: 'Center' },
  { value: 'outside', label: 'Outside' }
]

const STROKE_STYLES = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dash' },
  { value: 'dotted', label: 'Dot' }
] as const

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Tooltip label={label}>
      <button
        onClick={onClick}
        aria-label={label}
        className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-fg-muted transition-colors hover:text-fg hover:bg-fg/[0.08]"
      >
        <PlusIcon className="w-4 h-4" />
      </button>
    </Tooltip>
  )
}

function ShowButton({ shown, onClick }: { shown: boolean; onClick: () => void }) {
  return (
    <Tooltip label={shown ? 'Hide' : 'Show'}>
      <button
        onClick={onClick}
        aria-label={shown ? 'Hide' : 'Show'}
        aria-pressed={!shown}
        className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center transition-colors hover:bg-fg/[0.08] ${
          shown ? 'text-fg-muted hover:text-fg' : 'text-fg-faint hover:text-fg-muted'
        }`}
      >
        {shown ? <EyeIcon className="w-4 h-4" /> : <EyeSlashIcon className="w-4 h-4" />}
      </button>
    </Tooltip>
  )
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Tooltip label={label}>
      <button
        onClick={onClick}
        aria-label={label}
        className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-fg-muted transition-colors hover:text-danger hover:bg-danger/10"
      >
        <MinusIcon className="w-4 h-4" />
      </button>
    </Tooltip>
  )
}

function LayoutSection({ layout }: { layout: NodeView['layout'] }) {
  if (!layout) return null
  const value = layout.value
  const setPadding = (at: number, next: number) => {
    const padding = [...value.padding] as Layout['padding']
    padding[at] = next
    layout.set({ padding })
  }

  return (
    <Section
      title="Auto layout"
      action={
        value.direction === 'none' ? (
          <AddButton label="Add auto layout" onClick={() => layout.set({ direction: 'column' })} />
        ) : (
          <RemoveButton label="Remove auto layout" onClick={() => layout.set({ direction: 'none' })} />
        )
      }
    >
      {value.direction !== 'none' && (
        <>
          <Row>
            <Choice value={value.direction} options={DIRECTIONS} onPick={next => layout.set({ direction: next })} />
            <NumberInput label="Gap" value={value.gap} min={0} onChange={gap => layout.set({ gap })} />
          </Row>
          <SubLabel>Padding</SubLabel>
          <Row>
            {(['Top', 'Right', 'Btm', 'Left'] as const).map((label, at) => (
              <NumberInput
                key={label}
                label={label}
                value={value.padding[at]}
                min={0}
                onChange={next => setPadding(at, next)}
              />
            ))}
          </Row>
          <SubLabel>Alignment</SubLabel>
          <Row>
            <Choice value={value.align} options={ALIGNS} onPick={next => layout.set({ align: next })} />
            <Choice value={value.justify} options={JUSTIFIES} onPick={next => layout.set({ justify: next })} />
          </Row>
        </>
      )}
    </Section>
  )
}

function FillSection({ fills }: { fills: NodeView['fills'] }) {
  if (!fills) return null
  const remove = fills.remove
  return (
    <Section title="Fill" action={fills.add ? <AddButton label="Add fill" onClick={fills.add} /> : undefined}>
      {fills.items.map((fill, at) => (
        <div key={at} className="flex items-center gap-0.5">
          {fill.type === 'solid' ? (
            <ColorInput
              value={fill.color}
              onChange={color => fills.set(at, { ...fill, color })}
              opacity={fills.opacity ? fill.opacity : undefined}
              onOpacity={fills.opacity ? opacity => fills.set(at, { ...fill, opacity }) : undefined}
            />
          ) : (
            <span className="flex-1 h-8 rounded-full bg-fg/[0.06] flex items-center px-3 text-xs text-fg-muted">
              {fill.type === 'linear' ? 'Linear gradient' : 'Radial gradient'}
            </span>
          )}
          {fills.hide && (
            <ShowButton shown={fill.visible} onClick={() => fills.set(at, { ...fill, visible: !fill.visible })} />
          )}
          {remove && <RemoveButton label="Remove fill" onClick={() => remove(at)} />}
        </div>
      ))}
    </Section>
  )
}

function StrokeSection({ strokes }: { strokes: NodeView['strokes'] }) {
  if (!strokes) return null
  const remove = strokes.remove
  return (
    <Section title="Stroke" action={strokes.add ? <AddButton label="Add stroke" onClick={strokes.add} /> : undefined}>
      {strokes.items.map((stroke, at) => (
        <div key={at} className="flex flex-col gap-2">
          <div className="flex items-center gap-0.5">
            <ColorInput value={stroke.color} onChange={color => strokes.set(at, { color })} />
            {strokes.hide && (
              <ShowButton shown={stroke.visible} onClick={() => strokes.set(at, { visible: !stroke.visible })} />
            )}
            {remove && <RemoveButton label="Remove stroke" onClick={() => remove(at)} />}
          </div>
          <Row>
            {strokes.position && <SubLabel>Position</SubLabel>}
            <SubLabel>Weight</SubLabel>
          </Row>
          <Row>
            {strokes.position && (
              <Select
                full
                value={stroke.align}
                options={STROKE_POSITIONS}
                onChange={value => strokes.set(at, { align: value as Stroke['align'] })}
              />
            )}
            <NumberInput
              icon={<WeightGlyph className="w-4 h-4" />}
              value={stroke.weight}
              min={0}
              max={200}
              onChange={weight => strokes.set(at, { weight })}
            />
          </Row>
          <Choice
            value={stroke.style}
            options={STROKE_STYLES}
            onPick={value => strokes.set(at, { style: value as Stroke['style'] })}
          />
        </div>
      ))}
    </Section>
  )
}

function EffectsSection({ effects }: { effects: NodeView['effects'] }) {
  if (!effects) return null
  return (
    <Section title="Effects" action={<AddButton label="Add effect" onClick={effects.add} />}>
      {effects.items.map((effect, at) => (
        <div key={at} className="flex items-center gap-0.5">
          <EffectRow effect={effect} onChange={next => effects.set(at, next)} />
          <ShowButton shown={effect.visible} onClick={() => effects.set(at, { ...effect, visible: !effect.visible })} />
          <RemoveButton label="Remove effect" onClick={() => effects.remove(at)} />
        </div>
      ))}
    </Section>
  )
}

export default function Inspector({ view }: { view: NodeView }) {
  return (
    <>
      <LayoutSection layout={view.layout} />
      {view.text && <Typography text={view.text} />}
      <FillSection fills={view.fills} />
      <StrokeSection strokes={view.strokes} />
      <EffectsSection effects={view.effects} />
    </>
  )
}
