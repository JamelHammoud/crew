import { EyeDropperIcon } from '@heroicons/react/16/solid'
import { useEffect, useState } from 'react'
import { HexAlphaColorPicker, HexColorPicker } from 'react-colorful'
import { CREW_SWATCHES } from '../../../shared/design'
import Tooltip from '../components/Tooltip'

interface Dropper {
  open: () => Promise<{ sRGBHex: string }>
}

function tidy(hex: string): string {
  const clean = hex.toLowerCase()
  return clean.length === 9 && clean.endsWith('ff') ? clean.slice(0, 7) : clean
}

export default function ColorPicker({
  value,
  onChange,
  alpha
}: {
  value: string
  onChange: (value: string) => void
  alpha: boolean
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const Picker = alpha ? HexAlphaColorPicker : HexColorPicker
  const dropper = (window as unknown as { EyeDropper?: new () => Dropper }).EyeDropper

  const pick = async () => {
    if (!dropper) return
    try {
      const result = await new dropper().open()
      onChange(tidy(result.sRGBHex))
    } catch {
      return
    }
  }

  return (
    <div className="design-picker w-56 p-1 flex flex-col gap-2.5">
      <Picker color={value.slice(0, alpha ? 9 : 7)} onChange={next => onChange(tidy(next))} />
      <div className="flex items-center gap-1">
        <span className="flex-1 min-w-0 h-8 flex items-center gap-2 rounded-full bg-fg/[0.06] px-3 focus-within:bg-fg/[0.12] transition-colors">
          <span
            style={{ background: value }}
            className="w-4 h-4 shrink-0 rounded-full ring-1 ring-inset ring-fg/15"
          />
          <input
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onBlur={() => (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(draft) ? onChange(tidy(draft)) : setDraft(value))}
            onKeyDown={event => event.key === 'Enter' && event.currentTarget.blur()}
            aria-label="Hex"
            className="w-full min-w-0 bg-transparent text-xs font-mono uppercase text-fg outline-none"
          />
        </span>
        {dropper && (
          <Tooltip label="Pick a color">
            <button
              onClick={() => void pick()}
              aria-label="Pick a color"
              className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-fg-muted transition-colors hover:text-fg hover:bg-fg/[0.08]"
            >
              <EyeDropperIcon className="w-4 h-4" />
            </button>
          </Tooltip>
        )}
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {CREW_SWATCHES.map(swatch => (
          <button
            key={swatch.hex}
            onClick={() => onChange(swatch.hex)}
            aria-label={swatch.name}
            style={{ background: swatch.hex }}
            className={`h-6 rounded-full transition-transform hover:scale-110 active:scale-95 ${
              swatch.hex.toLowerCase() === value.toLowerCase()
                ? 'ring-2 ring-fg ring-offset-2 ring-offset-ink-800'
                : 'ring-1 ring-inset ring-fg/15'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
