import { useEditor, useValue, type TLFrameShape } from 'tldraw'
import { FRAME_BACKGROUND, frameBackground } from './frameFill'
import { ColorInput, Section } from './InspectorFields'

export default function FrameStyles({ shape }: { shape: TLFrameShape }) {
  const editor = useEditor()
  const background = frameBackground(shape.meta)

  const setBackground = (color: string) => {
    editor.markHistoryStoppingPoint()
    editor.updateShape({ id: shape.id, type: 'frame', meta: { background: color } })
  }

  return (
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
