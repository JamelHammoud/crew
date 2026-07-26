import { Fragment, useState } from 'react'
import { useEditor, useValue } from 'tldraw'
import type { Corner, DesignNodeProps } from '../../../shared/designNode'
import { PanelButton } from '../components/DesignControls'
import type { DesignNodeShape } from './DesignNodeUtil'
import Select from '../components/Select'
import { ClipGlyph, CornerGlyph, CornersGlyph, OpacityGlyph } from './glyphs'
import { MixedInput, NumberInput, Section, SubLabel } from './InspectorFields'

const BLENDS = [
  { value: 'normal', label: 'Normal' },
  { value: 'darken', label: 'Darken' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'color-burn', label: 'Color burn' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'screen', label: 'Screen' },
  { value: 'color-dodge', label: 'Color dodge' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'soft-light', label: 'Soft light' },
  { value: 'hard-light', label: 'Hard light' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
  { value: 'hue', label: 'Hue' },
  { value: 'saturation', label: 'Saturation' },
  { value: 'color', label: 'Color' },
  { value: 'luminosity', label: 'Luminosity' }
]

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
  const props = node ? (node.props as DesignNodeProps) : null
  const uniform = props ? props.radius.every(part => part === props.radius[0]) : true

  const setOpacity = (next: number) => {
    editor.run(() => {
      editor.setOpacityForSelectedShapes(next)
      editor.setOpacityForNextShapes(next)
    })
  }

  const setRadius = (radius: Corner) => {
    if (!node || !props) return
    editor.markHistoryStoppingPoint()
    editor.updateShape({ id: node.id, type: 'design-node', props: { ...props, radius } })
  }
  const patch = (next: Partial<DesignNodeProps>) => {
    if (!node || !props) return
    editor.markHistoryStoppingPoint()
    editor.updateShape({ id: node.id, type: 'design-node', props: { ...props, ...next } })
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
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
        <SubLabel>Opacity</SubLabel>
        {props ? <SubLabel>Corner radius</SubLabel> : <span />}
        <span />

        <NumberInput
          icon={<OpacityGlyph className="w-4 h-4" />}
          value={Math.round(value * 100)}
          min={10}
          max={100}
          suffix="%"
          onChange={next => setOpacity(next / 100)}
        />
        {props ? (
          uniform ? (
            <NumberInput icon={<CornersGlyph className="w-4 h-4" />} value={props.radius[0]} min={0} onChange={setAll} />
          ) : (
            <MixedInput label="Corner radius" icon={<CornersGlyph className="w-4 h-4" />} onChange={setAll} />
          )
        ) : (
          <span />
        )}
        {props ? (
          <PanelButton label="Each corner" active={perCorner} onClick={() => setPerCorner(open => !open)}>
            <CornerGlyph className="w-4 h-4" />
          </PanelButton>
        ) : (
          <span />
        )}

        {props &&
          perCorner &&
          CORNERS.map((corner, index) => (
            <Fragment key={corner.at}>
              <NumberInput
                icon={<CornerGlyph className={`w-4 h-4 ${corner.spin}`} />}
                value={props.radius[corner.at]}
                min={0}
                onChange={next => setOne(corner.at, next)}
              />
              {index % 2 === 1 && <span />}
            </Fragment>
          ))}
      </div>
      {props && (
        <>
          <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
            <SubLabel>Blend</SubLabel>
            <span />
            <Select full value={props.blend} options={BLENDS} onChange={blend => patch({ blend })} />
            <PanelButton label="Clip content" active={props.clip} onClick={() => patch({ clip: !props.clip })}>
              <ClipGlyph className="w-4 h-4" />
            </PanelButton>
          </div>
        </>
      )}
    </Section>
  )
}
