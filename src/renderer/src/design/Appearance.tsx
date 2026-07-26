import { Fragment, useState } from 'react'
import { useEditor, useValue } from 'tldraw'
import type { Corner } from '../../../shared/designNode'
import { PanelButton } from '../components/DesignControls'
import Select from '../components/Select'
import { ClipGlyph, CornerGlyph, CornersGlyph, OpacityGlyph } from './glyphs'
import { MixedInput, NumberInput, Section, SubLabel, Trailing } from './InspectorFields'
import type { NodeView } from './nodeView'

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

export default function Appearance({ view }: { view: NodeView | null }) {
  const editor = useEditor()
  const opacity = useValue('design opacity', () => editor.getSharedOpacity(), [editor])
  const [perCorner, setPerCorner] = useState(false)
  const value = opacity.type === 'shared' ? opacity.value : 1
  const radius = view?.radius ?? null
  const blend = view?.blend ?? null
  const clip = view?.clip ?? null
  const uniform = radius ? radius.value.every(part => part === radius.value[0]) : true

  const setOpacity = (next: number) => {
    editor.run(() => {
      editor.setOpacityForSelectedShapes(next)
      editor.setOpacityForNextShapes(next)
    })
  }

  const setAll = (next: number) => radius?.set([next, next, next, next])
  const setOne = (at: number, next: number) => {
    if (!radius) return
    const corners = [...radius.value] as Corner
    corners[at] = next
    radius.set(corners)
  }

  return (
    <Section title="Appearance">
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
        <SubLabel>Opacity</SubLabel>
        {radius ? <SubLabel>Corner radius</SubLabel> : <span />}
        <span />

        <NumberInput
          icon={<OpacityGlyph className="w-4 h-4" />}
          value={Math.round(value * 100)}
          min={10}
          max={100}
          suffix="%"
          onChange={next => setOpacity(next / 100)}
        />
        {radius ? (
          uniform ? (
            <NumberInput icon={<CornersGlyph className="w-4 h-4" />} value={radius.value[0]} min={0} onChange={setAll} />
          ) : (
            <MixedInput label="Corner radius" icon={<CornersGlyph className="w-4 h-4" />} onChange={setAll} />
          )
        ) : (
          <span />
        )}
        {radius ? (
          <Trailing>
            <PanelButton label="Each corner" active={perCorner} onClick={() => setPerCorner(open => !open)}>
              <CornerGlyph className="w-4 h-4" />
            </PanelButton>
          </Trailing>
        ) : (
          <span />
        )}

        {radius &&
          perCorner &&
          CORNERS.map((corner, index) => (
            <Fragment key={corner.at}>
              <NumberInput
                icon={<CornerGlyph className={`w-4 h-4 ${corner.spin}`} />}
                value={radius.value[corner.at]}
                min={0}
                onChange={next => setOne(corner.at, next)}
              />
              {index % 2 === 1 && <span />}
            </Fragment>
          ))}
      </div>
      {blend && (
        <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
          <SubLabel>Blend</SubLabel>
          <span />
          <Select full value={blend.value} options={BLENDS} onChange={next => blend.set(next)} />
          {clip && (
            <Trailing>
              <PanelButton label="Clip content" active={clip.value} onClick={() => clip.set(!clip.value)}>
                <ClipGlyph className="w-4 h-4" />
              </PanelButton>
            </Trailing>
          )}
        </div>
      )}
    </Section>
  )
}
