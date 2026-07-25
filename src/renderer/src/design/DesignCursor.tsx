import { CursorArrowRaysIcon } from '@heroicons/react/24/solid'

export default function DesignCursor({ hue }: { hue?: number }) {
  const color = hue === undefined ? 'currentColor' : `oklch(0.76 0.15 ${hue})`
  return (
    <span className="design-cursor-drift text-fg-muted">
      <CursorArrowRaysIcon className="w-5 h-5 drop-shadow" style={{ color }} strokeWidth={1.5} />
    </span>
  )
}
