import { Bars3BottomLeftIcon, Bars3BottomRightIcon, Bars3Icon } from '@heroicons/react/16/solid'
import { useCallback, type CSSProperties, type ReactNode } from 'react'
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
import { Section } from './InspectorFields'

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
  { value: 'serif', label: 'Serif', style: { fontFamily: 'Georgia, serif' } },
  { value: 'mono', label: 'Mono', className: 'font-mono' }
] as const

function Segments<T extends string>({
  value,
  options,
  onPick
}: {
  value: string | null
  options: ReadonlyArray<{ value: T; label?: string; icon?: ReactNode; style?: CSSProperties; className?: string }>
  onPick: (value: T) => void
}) {
  return (
    <div className="flex bg-fg/[0.06] rounded-full p-0.5">
      {options.map(option => (
        <button
          key={option.value}
          onClick={() => onPick(option.value)}
          style={option.style}
          aria-pressed={option.value === value}
          className={`flex-1 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
            option.value === value ? 'bg-fg text-ink-900' : 'text-fg-muted hover:text-fg'
          } ${option.className ?? ''}`}
        >
          {option.icon ?? option.label}
        </button>
      ))}
    </div>
  )
}

export default function ShapeStyles() {
  const editor = useEditor()
  const styles = useValue('design styles', () => editor.getSharedStyles(), [editor])
  const opacity = useValue('design opacity', () => editor.getSharedOpacity(), [editor])
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
  const opacityValue = opacity.type === 'shared' ? opacity.value : 1
  const shared = <T extends string>(style?: SharedStyle<T>) => (style && style.type === 'shared' ? style.value : null)

  const setOpacity = (value: number) => {
    editor.run(() => {
      editor.setOpacityForSelectedShapes(value)
      editor.setOpacityForNextShapes(value)
    })
  }

  return (
    <div className="design-style-panel flex flex-col gap-4 p-3">
      {color && (
        <Section label="Color">
          <div className="flex flex-wrap gap-1.5">
            {swatches.map(swatch => (
              <button
                key={swatch.name}
                onClick={() => apply(DefaultColorStyle, swatch.name)}
                aria-label={swatch.name}
                style={{ background: swatch.hex }}
                className={`w-5 h-5 rounded-full transition-transform hover:scale-110 active:scale-95 ${
                  shared(color) === swatch.name
                    ? 'ring-2 ring-fg ring-offset-2 ring-offset-ink-900'
                    : 'ring-1 ring-inset ring-fg/10'
                }`}
              />
            ))}
          </div>
        </Section>
      )}
      {fill && (
        <Section label="Fill">
          <Segments value={shared(fill)} options={FILL_OPTIONS} onPick={value => apply(DefaultFillStyle, value)} />
        </Section>
      )}
      {(dash || size) && (
        <Section label="Stroke">
          {dash && (
            <Segments value={shared(dash)} options={DASH_OPTIONS} onPick={value => apply(DefaultDashStyle, value)} />
          )}
          {size && (
            <Segments
              value={shared(size)}
              options={SIZE_OPTIONS.map(option => ({
                value: option.value,
                icon: <span className={`${option.dot} rounded-full bg-current`} />
              }))}
              onPick={value => apply(DefaultSizeStyle, value)}
            />
          )}
        </Section>
      )}
      {(font || align) && (
        <Section label="Text">
          {font && (
            <Segments value={shared(font)} options={FONT_OPTIONS} onPick={value => apply(DefaultFontStyle, value)} />
          )}
          {align && (
            <Segments
              value={shared(align)}
              options={[
                { value: 'start', icon: <Bars3BottomLeftIcon className="w-4 h-4" /> },
                { value: 'middle', icon: <Bars3Icon className="w-4 h-4" /> },
                { value: 'end', icon: <Bars3BottomRightIcon className="w-4 h-4" /> }
              ]}
              onPick={value => apply(DefaultTextAlignStyle, value)}
            />
          )}
        </Section>
      )}
      <Section label="Opacity">
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.01}
            value={opacityValue}
            onChange={e => setOpacity(Number(e.target.value))}
            aria-label="Opacity"
            className="flex-1 min-w-0"
          />
          <span className="w-8 text-right text-xs tabular-nums text-fg-muted">{Math.round(opacityValue * 100)}%</span>
        </div>
      </Section>
    </div>
  )
}
