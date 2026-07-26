import { ChevronDownIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'
import type { Effect } from '../../../shared/designNode'
import { Popover } from '../components/Popover'
import { BlurGlyph, ShadowGlyph } from './glyphs'
import { ColorInput, NumberInput, Row, SubLabel } from './InspectorFields'

const KINDS: Array<{ value: Effect['type']; label: string }> = [
  { value: 'inner-shadow', label: 'Inner shadow' },
  { value: 'shadow', label: 'Drop shadow' },
  { value: 'layer-blur', label: 'Layer blur' },
  { value: 'background-blur', label: 'Background blur' }
]

function labelOf(effect: Effect): string {
  return KINDS.find(kind => kind.value === effect.type)?.label ?? 'Effect'
}

function retype(effect: Effect, type: Effect['type']): Effect {
  if (type === effect.type) return effect
  if (type === 'layer-blur' || type === 'background-blur') return { type, blur: effect.blur, visible: effect.visible }
  const shadow = effect as Extract<Effect, { type: 'shadow' }>
  return {
    type,
    x: shadow.x ?? 0,
    y: shadow.y ?? 4,
    blur: effect.blur,
    spread: shadow.spread ?? 0,
    color: shadow.color ?? '#00000040',
    visible: effect.visible
  }
}

export default function EffectRow({ effect, onChange }: { effect: Effect; onChange: (next: Effect) => void }) {
  const [open, setOpen] = useState(false)
  const shadow = effect.type === 'shadow' || effect.type === 'inner-shadow' ? effect : null
  const Glyph = shadow ? ShadowGlyph : BlurGlyph

  return (
    <span className="relative flex-1 min-w-0 flex">
      <button
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        className={`flex-1 min-w-0 h-8 flex items-center gap-2 rounded-full px-3 text-xs text-left transition-colors ${
          open ? 'bg-fg/[0.12] text-fg' : 'bg-fg/[0.06] text-fg hover:bg-fg/[0.1]'
        }`}
      >
        <Glyph className="w-4 h-4 shrink-0 text-fg-muted" />
        <span className="flex-1 truncate">{labelOf(effect)}</span>
        <ChevronDownIcon className={`w-3.5 h-3.5 shrink-0 text-fg-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} align="start" className="w-60">
        <div className="flex flex-col gap-2 p-2">
          {KINDS.map(kind => (
            <button
              key={kind.value}
              onClick={() => onChange(retype(effect, kind.value))}
              aria-pressed={kind.value === effect.type}
              className={`w-full h-8 flex items-center gap-2 px-3 rounded-full text-xs text-left transition-colors ${
                kind.value === effect.type ? 'bg-fg text-ink-900' : 'text-fg-secondary hover:text-fg hover:bg-fg/5'
              }`}
            >
              {kind.label}
            </button>
          ))}
          <div className="h-px bg-fg/10 mx-1" />
          {shadow ? (
            <>
              <SubLabel>Position</SubLabel>
              <Row>
                <NumberInput label="X" value={shadow.x} onChange={x => onChange({ ...shadow, x })} />
                <NumberInput label="Y" value={shadow.y} onChange={y => onChange({ ...shadow, y })} />
              </Row>
              <SubLabel>Blur and spread</SubLabel>
              <Row>
                <NumberInput label="Blur" value={shadow.blur} min={0} onChange={blur => onChange({ ...shadow, blur })} />
                <NumberInput label="Spread" value={shadow.spread} onChange={spread => onChange({ ...shadow, spread })} />
              </Row>
              <SubLabel>Color</SubLabel>
              <ColorInput value={shadow.color} onChange={color => onChange({ ...shadow, color })} />
            </>
          ) : (
            <>
              <SubLabel>Blur</SubLabel>
              <NumberInput value={effect.blur} min={0} max={200} onChange={blur => onChange({ ...effect, blur })} />
            </>
          )}
        </div>
      </Popover>
    </span>
  )
}
