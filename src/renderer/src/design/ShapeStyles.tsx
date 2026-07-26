import { Bars3BottomLeftIcon, Bars3BottomRightIcon, Bars3Icon } from '@heroicons/react/16/solid'
import { useCallback } from 'react'
import {
  DefaultColorStyle,
  DefaultDashStyle,
  DefaultFillStyle,
  DefaultFontStyle,
  DefaultSizeStyle,
  DefaultTextAlignStyle,
  getColorValue,
  useEditor,
  useValue,
  type SharedStyle,
  type StyleProp
} from 'tldraw'
import { Choice, Row, Section, SubLabel } from './InspectorFields'

const FILL_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'semi', label: 'Semi' },
  { value: 'solid', label: 'Soft' },
  { value: 'fill', label: 'Fill' }
] as const

const DASH_OPTIONS = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dash' },
  { value: 'dotted', label: 'Dot' }
] as const

const SIZE_OPTIONS = [
  { value: 's', dot: 'w-1 h-1' },
  { value: 'm', dot: 'w-1.5 h-1.5' },
  { value: 'l', dot: 'w-2 h-2' },
  { value: 'xl', dot: 'w-2.5 h-2.5' }
] as const

const FONT_OPTIONS = [
  { value: 'sans', label: 'Sans' },
  { value: 'serif', label: 'Serif' },
  { value: 'mono', label: 'Mono' }
] as const

const TEXT_ALIGNS = [
  { value: 'start', label: 'Left', icon: <Bars3BottomLeftIcon className="w-4 h-4" /> },
  { value: 'middle', label: 'Center', icon: <Bars3Icon className="w-4 h-4" /> },
  { value: 'end', label: 'Right', icon: <Bars3BottomRightIcon className="w-4 h-4" /> }
] as const

export default function ShapeStyles() {
  const editor = useEditor()
  const styles = useValue('design styles', () => editor.getSharedStyles(), [editor])
  const swatches = useValue(
    'design swatches',
    () => {
      const palette = editor.getCurrentTheme().colors[editor.getColorMode()]
      return DefaultColorStyle.values.map(name => ({ name, hex: getColorValue(palette, name, 'solid') }))
    },
    [editor]
  )

  const apply = useCallback(
    <T,>(style: StyleProp<T>, value: T) => {
      editor.run(() => {
        editor.markHistoryStoppingPoint()
        if (editor.isIn('select')) editor.setStyleForSelectedShapes(style, value)
        editor.setStyleForNextShapes(style, value)
      })
    },
    [editor]
  )

  const color = styles.get(DefaultColorStyle)
  const fill = styles.get(DefaultFillStyle)
  const dash = styles.get(DefaultDashStyle)
  const size = styles.get(DefaultSizeStyle)
  const font = styles.get(DefaultFontStyle)
  const align = styles.get(DefaultTextAlignStyle)
  const shared = <T extends string>(style?: SharedStyle<T>) => (style && style.type === 'shared' ? style.value : null)

  return (
    <>
      {(color || fill) && (
        <Section title="Fill">
          {color && (
            <div className="grid grid-cols-7 gap-1.5">
              {swatches.map(swatch => (
                <button
                  key={swatch.name}
                  onClick={() => apply(DefaultColorStyle, swatch.name)}
                  aria-label={swatch.name}
                  style={{ background: swatch.hex }}
                  className={`w-6 h-6 rounded-full transition-transform hover:scale-110 active:scale-95 ${
                    shared(color) === swatch.name
                      ? 'ring-2 ring-fg ring-offset-2 ring-offset-ink-900'
                      : 'ring-1 ring-inset ring-fg/10'
                  }`}
                />
              ))}
            </div>
          )}
          {fill && (
            <Choice value={shared(fill)} options={FILL_OPTIONS} onPick={value => apply(DefaultFillStyle, value)} />
          )}
        </Section>
      )}

      {(dash || size) && (
        <Section title="Stroke">
          <Row>
            {dash && (
              <Choice value={shared(dash)} options={DASH_OPTIONS} onPick={value => apply(DefaultDashStyle, value)} />
            )}
            {size && (
              <Choice
                value={shared(size)}
                options={SIZE_OPTIONS.map(option => ({
                  value: option.value,
                  label: option.value.toUpperCase(),
                  icon: <span className={`${option.dot} rounded-full bg-current`} />
                }))}
                onPick={value => apply(DefaultSizeStyle, value)}
              />
            )}
          </Row>
        </Section>
      )}

      {(font || align) && (
        <Section title="Text">
          {font && (
            <>
              <SubLabel>Font</SubLabel>
              <Choice value={shared(font)} options={FONT_OPTIONS} onPick={value => apply(DefaultFontStyle, value)} />
            </>
          )}
          {align && (
            <>
              <SubLabel>Alignment</SubLabel>
              <Choice value={shared(align)} options={TEXT_ALIGNS} onPick={value => apply(DefaultTextAlignStyle, value)} />
            </>
          )}
        </Section>
      )}
    </>
  )
}
