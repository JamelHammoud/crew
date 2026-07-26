import { Bars3BottomLeftIcon, Bars3BottomRightIcon, Bars3Icon, MinusIcon, PlusIcon } from '@heroicons/react/16/solid'
import { useEditor, useValue } from 'tldraw'
import { NEW_FILL, NEW_STROKE } from '../../../shared/design'
import type { Corner, DesignNodeProps, Effect, Layout, Paint, Stroke } from '../../../shared/designNode'
import type { DesignNodeShape } from './DesignNodeUtil'
import { Choice, ColorInput, NumberInput, Row, Section, SubLabel } from './InspectorFields'

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

const TEXT_ALIGNS = [
  { value: 'left', label: 'Left', icon: <Bars3BottomLeftIcon className="w-3.5 h-3.5" /> },
  { value: 'center', label: 'Center', icon: <Bars3Icon className="w-3.5 h-3.5" /> },
  { value: 'right', label: 'Right', icon: <Bars3BottomRightIcon className="w-3.5 h-3.5" /> }
] as const

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-fg-muted transition-colors hover:text-fg hover:bg-fg/[0.08]"
    >
      <PlusIcon className="w-4 h-4" />
    </button>
  )
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-fg-muted transition-colors hover:text-danger hover:bg-danger/10"
    >
      <MinusIcon className="w-4 h-4" />
    </button>
  )
}

export default function Inspector({ shape }: { shape: DesignNodeShape }) {
  const editor = useEditor()
  const props = shape.props

  const patch = (next: Partial<DesignNodeProps>) => {
    editor.markHistoryStoppingPoint()
    editor.updateShape({ id: shape.id, type: 'design-node', props: { ...props, ...next } })
  }
  const setLayout = (next: Partial<Layout>) => patch({ layout: { ...props.layout, ...next } })
  const setPadding = (at: number, value: number) => {
    const padding = [...props.layout.padding] as Corner
    padding[at] = value
    setLayout({ padding })
  }
  const setFill = (at: number, next: Paint) => patch({ fills: props.fills.map((fill, i) => (i === at ? next : fill)) })
  const setStroke = (at: number, next: Partial<Stroke>) =>
    patch({ strokes: props.strokes.map((stroke, i) => (i === at ? { ...stroke, ...next } : stroke)) })
  const setEffect = (at: number, next: Partial<Effect>) =>
    patch({ effects: props.effects.map((effect, i) => (i === at ? ({ ...effect, ...next } as Effect) : effect)) })

  return (
    <>
      <Section
        title="Auto layout"
        action={
          props.layout.direction === 'none' ? (
            <AddButton label="Add auto layout" onClick={() => setLayout({ direction: 'column' })} />
          ) : (
            <RemoveButton label="Remove auto layout" onClick={() => setLayout({ direction: 'none' })} />
          )
        }
      >
        {props.layout.direction !== 'none' && (
          <>
            <Row>
              <Choice value={props.layout.direction} options={DIRECTIONS} onPick={value => setLayout({ direction: value })} />
              <NumberInput label="Gap" value={props.layout.gap} min={0} onChange={value => setLayout({ gap: value })} />
            </Row>
            <SubLabel>Padding</SubLabel>
            <Row>
              {(['Top', 'Right', 'Btm', 'Left'] as const).map((label, at) => (
                <NumberInput
                  key={label}
                  label={label}
                  value={props.layout.padding[at]}
                  min={0}
                  onChange={value => setPadding(at, value)}
                />
              ))}
            </Row>
            <SubLabel>Alignment</SubLabel>
            <Row>
              <Choice value={props.layout.align} options={ALIGNS} onPick={value => setLayout({ align: value })} />
              <Choice value={props.layout.justify} options={JUSTIFIES} onPick={value => setLayout({ justify: value })} />
            </Row>
          </>
        )}
      </Section>

      <Section
        title="Fill"
        action={
          <AddButton
            label="Add fill"
            onClick={() => patch({ fills: [...props.fills, { type: 'solid', color: NEW_FILL, opacity: 1 }] })}
          />
        }
      >
        {props.fills.map((fill, at) => (
          <div key={at} className="flex items-center gap-1">
            {fill.type === 'solid' ? (
              <ColorInput
                value={fill.color}
                onChange={color => setFill(at, { ...fill, color })}
                opacity={fill.opacity}
                onOpacity={opacity => setFill(at, { ...fill, opacity })}
              />
            ) : (
              <span className="flex-1 h-8 rounded-full bg-fg/[0.06] flex items-center px-3 text-xs text-fg-muted">
                {fill.type === 'linear' ? 'Linear gradient' : 'Radial gradient'}
              </span>
            )}
            <RemoveButton label="Remove fill" onClick={() => patch({ fills: props.fills.filter((_, i) => i !== at) })} />
          </div>
        ))}
      </Section>

      <Section
        title="Stroke"
        action={
          <AddButton
            label="Add stroke"
            onClick={() =>
              patch({ strokes: [...props.strokes, { color: NEW_STROKE, weight: 1, align: 'inside', style: 'solid' }] })
            }
          />
        }
      >
        {props.strokes.map((stroke, at) => (
          <div key={at} className="flex items-center gap-1">
            <ColorInput value={stroke.color} onChange={color => setStroke(at, { color })} />
            <span className="w-16 shrink-0 flex">
              <NumberInput value={stroke.weight} min={0} max={200} onChange={weight => setStroke(at, { weight })} />
            </span>
            <RemoveButton
              label="Remove stroke"
              onClick={() => patch({ strokes: props.strokes.filter((_, i) => i !== at) })}
            />
          </div>
        ))}
      </Section>

      <Section
        title="Effects"
        action={
          <AddButton
            label="Add effect"
            onClick={() =>
              patch({
                effects: [...props.effects, { type: 'shadow', x: 0, y: 8, blur: 24, spread: -4, color: '#00000059' }]
              })
            }
          />
        }
      >
        {props.effects.map((effect, at) => (
          <div key={at} className="flex items-center gap-1">
            {effect.type === 'shadow' || effect.type === 'inner-shadow' ? (
              <>
                <ColorInput value={effect.color} onChange={color => setEffect(at, { color } as Partial<Effect>)} />
                <span className="w-16 shrink-0 flex">
                  <NumberInput value={effect.blur} min={0} onChange={blur => setEffect(at, { blur } as Partial<Effect>)} />
                </span>
              </>
            ) : (
              <>
                <span className="flex-1 h-8 rounded-full bg-fg/[0.06] flex items-center px-3 text-xs text-fg-muted">
                  {effect.type === 'layer-blur' ? 'Layer blur' : 'Background blur'}
                </span>
                <span className="w-16 shrink-0 flex">
                  <NumberInput value={effect.blur} min={0} onChange={blur => setEffect(at, { blur } as Partial<Effect>)} />
                </span>
              </>
            )}
            <RemoveButton
              label="Remove effect"
              onClick={() => patch({ effects: props.effects.filter((_, i) => i !== at) })}
            />
          </div>
        ))}
      </Section>

      {props.text !== '' && (
        <Section title="Text">
          <Row>
            <NumberInput label="Size" value={props.type.size} min={1} onChange={size => patch({ type: { ...props.type, size } })} />
            <NumberInput
              label="Weight"
              value={props.type.weight}
              min={100}
              max={900}
              onChange={weight => patch({ type: { ...props.type, weight } })}
            />
          </Row>
          <ColorInput value={props.type.color} onChange={color => patch({ type: { ...props.type, color } })} />
          <Choice
            value={props.type.align}
            options={TEXT_ALIGNS}
            onPick={align => patch({ type: { ...props.type, align } })}
          />
        </Section>
      )}
    </>
  )
}

export function useSelectedNode(): DesignNodeShape | null {
  const editor = useEditor()
  return useValue(
    'design selected node',
    () => {
      const selected = editor.getSelectedShapes()
      if (selected.length !== 1 || selected[0].type !== 'design-node') return null
      return selected[0] as DesignNodeShape
    },
    [editor]
  )
}
