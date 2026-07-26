import { ChevronDownIcon, MinusIcon } from '@heroicons/react/16/solid'
import { useState, type ReactNode } from 'react'
import { BASE_TYPE, type TypeStyle } from '../../../shared/designNode'
import { PanelButton } from '../components/DesignControls'
import { MenuItem, Popover } from '../components/Popover'
import Select from '../components/Select'
import FontPicker from './FontPicker'
import {
  AlignCenterGlyph,
  AlignLeftGlyph,
  AlignRightGlyph,
  LetterSpacingGlyph,
  LineHeightGlyph,
  StrikeGlyph,
  TextBottomGlyph,
  TextMiddleGlyph,
  TextTopGlyph,
  TypeSettingsGlyph,
  UnderlineGlyph
} from './glyphs'
import { Choice, ColorInput, NumberInput, Row, Section, SubLabel, Trailing } from './InspectorFields'
import type { TextControl } from './nodeView'
import { FACES, SIZES, faceStyle, faceValue } from './typeFaces'

const ALIGNS = [
  { value: 'left', label: 'Align left', icon: <AlignLeftGlyph className="w-4 h-4" /> },
  { value: 'center', label: 'Align center', icon: <AlignCenterGlyph className="w-4 h-4" /> },
  { value: 'right', label: 'Align right', icon: <AlignRightGlyph className="w-4 h-4" /> }
] as const

const VERTICALS = [
  { value: 'top', label: 'Align top', icon: <TextTopGlyph className="w-4 h-4" /> },
  { value: 'middle', label: 'Align middle', icon: <TextMiddleGlyph className="w-4 h-4" /> },
  { value: 'bottom', label: 'Align bottom', icon: <TextBottomGlyph className="w-4 h-4" /> }
] as const

const CASES = [
  { value: 'none', label: 'As typed', icon: <MinusIcon className="w-4 h-4" /> },
  { value: 'upper', label: 'Upper case', icon: <span className="text-xs font-semibold">AG</span> },
  { value: 'lower', label: 'Lower case', icon: <span className="text-xs font-semibold">ag</span> }
] as const

const DECORATIONS = [
  { value: 'none', label: 'No decoration', icon: <MinusIcon className="w-4 h-4" /> },
  { value: 'underline', label: 'Underline', icon: <UnderlineGlyph className="w-4 h-4" /> },
  { value: 'strike', label: 'Strikethrough', icon: <StrikeGlyph className="w-4 h-4" /> }
] as const

function Pair({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  if (left && right) {
    return (
      <Row>
        {left}
        {right}
      </Row>
    )
  }
  return <>{left ?? right ?? null}</>
}

function SizePicker({ onPick }: { onPick: (size: number) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative shrink-0 flex">
      <button
        onClick={() => setOpen(value => !value)}
        aria-label="Font sizes"
        aria-expanded={open}
        className="w-5 h-6 -mr-1 rounded-full flex items-center justify-center text-fg-muted transition-colors hover:text-fg"
      >
        <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} align="end" className="w-20 max-h-72 overflow-y-auto">
        {SIZES.map(size => (
          <MenuItem
            key={size}
            label={String(size)}
            onClick={() => {
              onPick(size)
              setOpen(false)
            }}
          />
        ))}
      </Popover>
    </span>
  )
}

function TypeSettings({ value, set }: { value: TypeStyle; set: (patch: Partial<TypeStyle>) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative flex">
      <PanelButton label="Type settings" active={open} onClick={() => setOpen(current => !current)}>
        <TypeSettingsGlyph className="w-4 h-4" />
      </PanelButton>
      <Popover open={open} onClose={() => setOpen(false)} align="end" className="w-52">
        <div className="flex flex-col gap-2 p-1">
          <SubLabel>Case</SubLabel>
          <Choice value={value.transform} options={CASES} onPick={transform => set({ transform })} />
          <SubLabel>Decoration</SubLabel>
          <Choice value={value.decoration} options={DECORATIONS} onPick={decoration => set({ decoration })} />
        </div>
      </Popover>
    </span>
  )
}

export default function Typography({ text }: { text: TextControl }) {
  const { fields, set } = text
  const value = { ...BASE_TYPE, ...text.value }

  return (
    <Section title="Typography">
      {fields.family && <FontPicker value={value.family} onChange={family => set({ family })} />}
      <Pair
        left={
          fields.weight ? (
            <Select full value={faceValue(value)} options={FACES} onChange={face => set(faceStyle(face))} />
          ) : undefined
        }
        right={
          fields.size ? (
            <NumberInput
              label="Size"
              value={value.size}
              min={1}
              max={800}
              onChange={size => set({ size })}
              after={<SizePicker onPick={size => set({ size })} />}
            />
          ) : undefined
        }
      />
      {(fields.lineHeight || fields.spacing) && (
        <>
          <Pair
            left={fields.lineHeight ? <SubLabel>Line height</SubLabel> : undefined}
            right={fields.spacing ? <SubLabel>Letter spacing</SubLabel> : undefined}
          />
          <Pair
            left={
              fields.lineHeight ? (
                <NumberInput
                  label="Line height"
                  icon={<LineHeightGlyph className="w-4 h-4" />}
                  value={Math.round(value.lineHeight * 100)}
                  min={50}
                  max={400}
                  suffix="%"
                  auto={Math.round(BASE_TYPE.lineHeight * 100)}
                  onChange={next => set({ lineHeight: next / 100 })}
                />
              ) : undefined
            }
            right={
              fields.spacing ? (
                <NumberInput
                  label="Letter spacing"
                  icon={<LetterSpacingGlyph className="w-4 h-4" />}
                  value={value.spacing}
                  min={-20}
                  max={100}
                  onChange={spacing => set({ spacing })}
                />
              ) : undefined
            }
          />
        </>
      )}
      {(fields.align || fields.vertical) && (
        <>
          <SubLabel>Alignment</SubLabel>
          <div className="flex items-center gap-2">
            {fields.align && (
              <span className="flex-1 min-w-0 flex">
                <Choice value={value.align} options={ALIGNS} onPick={align => set({ align })} />
              </span>
            )}
            {fields.vertical && (
              <span className="flex-1 min-w-0 flex">
                <Choice value={value.vertical} options={VERTICALS} onPick={vertical => set({ vertical })} />
              </span>
            )}
            {fields.settings && (
              <Trailing>
                <TypeSettings value={value} set={set} />
              </Trailing>
            )}
          </div>
        </>
      )}
      {fields.color && <ColorInput value={value.color} onChange={color => set({ color })} />}
    </Section>
  )
}
