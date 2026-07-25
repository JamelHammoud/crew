import { Bars3BottomLeftIcon, Bars3BottomRightIcon, Bars3Icon, PlusIcon, TrashIcon } from '@heroicons/react/16/solid'
import { useEditor, useValue } from 'tldraw'
import { NEW_FILL, NEW_STROKE } from '../../../shared/design'
import type { Corner, DesignNodeProps, Effect, Layout, Paint, Stroke } from '../../../shared/designNode'
import type { DesignNodeShape } from './DesignNodeUtil'
import { Choice, ColorInput, Field, NumberInput, Section } from './InspectorFields'

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
      className="w-5 h-5 rounded-full flex items-center justify-center text-fg-muted transition-colors hover:text-fg hover:bg-fg/[0.08]"
    >
      <PlusIcon className="w-3.5 h-3.5" />
    </button>
  )
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-fg-muted transition-colors hover:text-danger hover:bg-danger/10"
    >
      <TrashIcon className="w-3 h-3" />
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
  const move = (next: { x?: number; y?: number }) => {
    editor.markHistoryStoppingPoint()
    editor.updateShape({ id: shape.id, type: 'design-node', x: next.x ?? shape.x, y: next.y ?? shape.y })
  }
  const setRadius = (at: number, value: number) => {
    const radius = [...props.radius] as Corner
    radius[at] = value
    patch({ radius })
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

  const uniform = props.radius.every(part => part === props.radius[0])

  return (
    <div className="design-style-panel glass rounded-2xl w-64 m-3 p-3 pointer-events-auto animate-pop flex flex-col gap-4 max-h-[74vh] overflow-y-auto">
      <input
        value={props.name}
        onChange={e => patch({ name: e.target.value })}
        aria-label="Layer name"
        className="h-7 rounded-full bg-fg/[0.06] px-3 text-xs font-semibold text-fg outline-none focus:bg-fg/[0.1]"
      />

      <Section label="Position">
        <div className="flex gap-2">
          <Field label="X">
            <NumberInput value={shape.x} onChange={value => move({ x: value })} />
          </Field>
          <Field label="Y">
            <NumberInput value={shape.y} onChange={value => move({ y: value })} />
          </Field>
        </div>
        <div className="flex gap-2">
          <Field label="W">
            <NumberInput value={props.w} min={1} onChange={value => patch({ w: value })} />
          </Field>
          <Field label="H">
            <NumberInput value={props.h} min={1} onChange={value => patch({ h: value })} />
          </Field>
        </div>
      </Section>

      <Section
        label="Corner radius"
        action={
          <button
            onClick={() => patch({ radius: [props.radius[0], props.radius[0], props.radius[0], props.radius[0]] })}
            className="text-xs text-fg-muted transition-colors hover:text-fg"
          >
            {uniform ? 'All' : 'Match'}
          </button>
        }
      >
        {uniform ? (
          <Field label="All">
            <NumberInput
              value={props.radius[0]}
              min={0}
              onChange={value => patch({ radius: [value, value, value, value] })}
            />
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {(['TL', 'TR', 'BR', 'BL'] as const).map((label, at) => (
              <Field key={label} label={label}>
                <NumberInput value={props.radius[at]} min={0} onChange={value => setRadius(at, value)} />
              </Field>
            ))}
          </div>
        )}
        {uniform && (
          <button
            onClick={() => setRadius(1, props.radius[1])}
            className="self-start text-xs text-fg-muted transition-colors hover:text-fg"
          >
            Set each corner
          </button>
        )}
      </Section>

      <Section label="Auto layout">
        <Field label="Flow">
          <Choice value={props.layout.direction} options={DIRECTIONS} onPick={value => setLayout({ direction: value })} />
        </Field>
        {props.layout.direction !== 'none' && (
          <>
            <Field label="Gap">
              <NumberInput value={props.layout.gap} min={0} onChange={value => setLayout({ gap: value })} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              {(['Top', 'Right', 'Btm', 'Left'] as const).map((label, at) => (
                <Field key={label} label={label}>
                  <NumberInput value={props.layout.padding[at]} min={0} onChange={value => setPadding(at, value)} />
                </Field>
              ))}
            </div>
            <Field label="Align">
              <Choice value={props.layout.align} options={ALIGNS} onPick={value => setLayout({ align: value })} />
            </Field>
            <Field label="Space">
              <Choice value={props.layout.justify} options={JUSTIFIES} onPick={value => setLayout({ justify: value })} />
            </Field>
          </>
        )}
      </Section>

      <Section
        label="Fill"
        action={<AddButton label="Add fill" onClick={() => patch({ fills: [...props.fills, { type: 'solid', color: NEW_FILL, opacity: 1 }] })} />}
      >
        {props.fills.map((fill, at) => (
          <div key={at} className="flex items-center gap-1.5">
            {fill.type === 'solid' ? (
              <ColorInput value={fill.color} onChange={color => setFill(at, { ...fill, color })} />
            ) : (
              <span className="flex-1 h-7 rounded-full bg-fg/[0.06] flex items-center px-3 text-xs text-fg-muted">
                {fill.type === 'linear' ? 'Linear gradient' : 'Radial gradient'}
              </span>
            )}
            <RemoveButton label="Remove fill" onClick={() => patch({ fills: props.fills.filter((_, i) => i !== at) })} />
          </div>
        ))}
      </Section>

      <Section
        label="Stroke"
        action={
          <AddButton
            label="Add stroke"
            onClick={() => patch({ strokes: [...props.strokes, { color: NEW_STROKE, weight: 1, align: 'inside', style: 'solid' }] })}
          />
        }
      >
        {props.strokes.map((stroke, at) => (
          <div key={at} className="flex items-center gap-1.5">
            <ColorInput value={stroke.color} onChange={color => setStroke(at, { color })} />
            <NumberInput value={stroke.weight} min={0} max={200} onChange={weight => setStroke(at, { weight })} />
            <RemoveButton
              label="Remove stroke"
              onClick={() => patch({ strokes: props.strokes.filter((_, i) => i !== at) })}
            />
          </div>
        ))}
      </Section>

      <Section
        label="Effects"
        action={
          <AddButton
            label="Add effect"
            onClick={() =>
              patch({ effects: [...props.effects, { type: 'shadow', x: 0, y: 8, blur: 24, spread: -4, color: '#00000059' }] })
            }
          />
        }
      >
        {props.effects.map((effect, at) => (
          <div key={at} className="flex items-center gap-1.5">
            {effect.type === 'shadow' || effect.type === 'inner-shadow' ? (
              <>
                <ColorInput value={effect.color} onChange={color => setEffect(at, { color } as Partial<Effect>)} />
                <NumberInput value={effect.blur} min={0} onChange={blur => setEffect(at, { blur } as Partial<Effect>)} />
              </>
            ) : (
              <>
                <span className="flex-1 h-7 rounded-full bg-fg/[0.06] flex items-center px-3 text-xs text-fg-muted">
                  {effect.type === 'layer-blur' ? 'Layer blur' : 'Background blur'}
                </span>
                <NumberInput value={effect.blur} min={0} onChange={blur => setEffect(at, { blur } as Partial<Effect>)} />
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
        <Section label="Text">
          <div className="flex gap-2">
            <Field label="Size">
              <NumberInput value={props.type.size} min={1} onChange={size => patch({ type: { ...props.type, size } })} />
            </Field>
            <Field label="Wt">
              <NumberInput
                value={props.type.weight}
                min={100}
                max={900}
                onChange={weight => patch({ type: { ...props.type, weight } })}
              />
            </Field>
          </div>
          <Field label="Color">
            <ColorInput value={props.type.color} onChange={color => patch({ type: { ...props.type, color } })} />
          </Field>
          <Field label="Align">
            <Choice
              value={props.type.align}
              options={TEXT_ALIGNS}
              onPick={align => patch({ type: { ...props.type, align } })}
            />
          </Field>
        </Section>
      )}
    </div>
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
