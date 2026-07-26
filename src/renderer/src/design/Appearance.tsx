import { useState } from 'react'
import { useEditor, useValue } from 'tldraw'
import { PanelButton } from '../components/DesignControls'
import type { Corner, DesignNodeProps } from '../../../shared/designNode'
import type { DesignNodeShape } from './DesignNodeUtil'
import { CornerGlyph, CornersGlyph, OpacityGlyph } from './glyphs'
import { MixedInput, NumberInput, Row, Section, SubLabel } from './InspectorFields'

const CORNERS: Array<{ at: number; label: string; spin: string }> = [
  { at: 0, label: 'Top left', spin: '' },
  { at: 1, label: 'Top right', spin: 'rotate-90' },
  { at: 3, label: 'Bottom left', spin: '-rotate-90' },
  { at: 2, label: 'Bottom right', spin: 'rotate-180' }
]

export default function Appearance({ node }: { node: DesignNodeShape | null }) {
  const editor = useEditor()
  const opacity = useValue('design opacity', () => editor.getSharedOpacity(), [editor])
  const [perCorner, setPerCorner] = useState(false)
  const value = opacity.type === 'shared' ? opacity.value : 1

  const setOpacity = (next: number) => {
    editor.run(() => {
      editor.setOpacityForSelectedShapes(next)
      editor.setOpacityForNextShapes(next)
    })
  }

  const props = node?.props as DesignNodeProps | undefined
  const uniform = props ? props.radius.every(part => part === props.radius[0]) : true
  const setRadius = (radius: Corner) => {
    if (!node || !props) return
    editor.markHistoryStoppingPoint()
    editor.updateShape({ id: node.id, type: 'design-node', props: { ...props, radius } })
  }
  const setAll = (next: number) => setRadius([next, next, next, next])
  const setOne = (at: number, next: number) => {
    if (!props) return
    const radius = [...props.radius] as Corner
    radius[at] = next
    setRadius(radius)
  }

  return (
    <Section title="Appearance">
      <Row>
        <SubLabel>Opacity</SubLabel>
        {props && <SubLabel>Corner radius</SubLabel>}
      </Row>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0 grid grid-cols-1 gap-2">
          <NumberInput
            icon={<OpacityGlyph className="w-4 h-4" />}
            value={Math.round(value * 100)}
            min={10}
            max={100}
            suffix="%"
            onChange={next => setOpacity(next / 100)}
          />
        </div>
        {props && (
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            {uniform ? (
              <NumberInput
                icon={<CornersGlyph className="w-4 h-4" />}
                value={props.radius[0]}
                min={0}
                onChange={setAll}
              />
            ) : (
              <MixedInput label="Corner radius" icon={<CornersGlyph className="w-4 h-4" />} onChange={setAll} />
            )}
          </div>
        )}
        {props && (
          <PanelButton
            label="Each corner"
            active={perCorner}
            onClick={() => setPerCorner(open => !open)}
          >
            <CornerGlyph className="w-4 h-4" />
          </PanelButton>
        )}
      </div>
      {props && perCorner && (
        <Row>
          {CORNERS.map(corner => (
            <NumberInput
              key={corner.at}
              icon={<CornerGlyph className={`w-4 h-4 ${corner.spin}`} />}
              value={props.radius[corner.at]}
              min={0}
              onChange={next => setOne(corner.at, next)}
            />
          ))}
        </Row>
      )}
    </Section>
  )
}
