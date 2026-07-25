import { useEditor, useValue, type TLFrameShape } from 'tldraw'
import { FRAME_BACKGROUND, frameBackground } from './frameFill'
import { ColorInput, Field, NumberInput, Section } from './InspectorFields'

export default function FrameStyles({ shape }: { shape: TLFrameShape }) {
  const editor = useEditor()
  const background = frameBackground(shape.meta)

  const patch = (props: Partial<TLFrameShape['props']>) => {
    editor.markHistoryStoppingPoint()
    editor.updateShape({ id: shape.id, type: 'frame', props })
  }
  const move = (next: { x?: number; y?: number }) => {
    editor.markHistoryStoppingPoint()
    editor.updateShape({ id: shape.id, type: 'frame', x: next.x ?? shape.x, y: next.y ?? shape.y })
  }
  const setBackground = (color: string) => {
    editor.markHistoryStoppingPoint()
    editor.updateShape({ id: shape.id, type: 'frame', meta: { background: color } })
  }

  return (
    <div className="design-style-panel flex flex-col gap-4 p-3">
      <input
        value={shape.props.name}
        onChange={e => patch({ name: e.target.value })}
        placeholder="Frame"
        aria-label="Frame name"
        className="h-7 rounded-full bg-fg/[0.06] px-3 text-xs font-semibold text-fg placeholder:text-fg-faint outline-none focus:bg-fg/[0.1]"
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
            <NumberInput value={shape.props.w} min={1} onChange={value => patch({ w: value })} />
          </Field>
          <Field label="H">
            <NumberInput value={shape.props.h} min={1} onChange={value => patch({ h: value })} />
          </Field>
        </div>
      </Section>

      <Section
        label="Background"
        action={
          background === FRAME_BACKGROUND ? undefined : (
            <button
              onClick={() => setBackground(FRAME_BACKGROUND)}
              className="text-xs text-fg-muted transition-colors hover:text-fg"
            >
              Reset
            </button>
          )
        }
      >
        <ColorInput value={background} onChange={setBackground} />
      </Section>
    </div>
  )
}

export function useSelectedFrame(): TLFrameShape | null {
  const editor = useEditor()
  return useValue(
    'design selected frame',
    () => {
      const selected = editor.getSelectedShapes()
      if (selected.length !== 1 || selected[0].type !== 'frame') return null
      return selected[0] as TLFrameShape
    },
    [editor]
  )
}
