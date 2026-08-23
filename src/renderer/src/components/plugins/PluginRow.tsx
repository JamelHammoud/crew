import { CheckGlyph, PanelRightGlyph, PlusGlyph, TrashGlyph } from '../../icons'
import Tooltip from '../Tooltip'
import Spinner from '../Spinner'
import PluginMark from './PluginMark'

export default function PluginRow({
  seed,
  label,
  blurb,
  held,
  busy,
  trouble,
  actionLabel,
  onAdd,
  onOpen,
  onRemove
}: {
  seed: string
  label: string
  blurb: string
  held?: boolean
  busy?: boolean
  trouble?: string
  actionLabel?: string
  onAdd?: () => void
  onOpen?: () => void
  onRemove?: () => void
}) {
  const hasStableAction = Boolean(onAdd || held || onOpen)

  return (
    <div className="group relative flex items-center gap-3 px-3 py-2.5 -mx-3 rounded-2xl transition-colors hover:bg-fg/[0.03]">
      <PluginMark seed={seed} box={40} />
      <span className="flex-1 min-w-0">
        <span className="block text-base text-fg truncate">{label}</span>
        {(trouble || blurb) && (
          <span className={`block text-sm truncate ${trouble ? 'text-danger' : 'text-fg-muted'}`}>
            {trouble || blurb}
          </span>
        )}
      </span>
      <span className="relative flex shrink-0 items-center" data-plugin-actions>
        {onAdd && (
          <Tooltip label={actionLabel ?? `Add ${label}`} disabled={busy}>
            <button
              onClick={onAdd}
              disabled={busy}
              aria-label={actionLabel ?? `Add ${label}`}
              className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-fg-muted transition-all duration-150 hover:bg-fg/10 hover:text-fg active:scale-90 disabled:pointer-events-none"
            >
              {busy ? <Spinner size={16} /> : <PlusGlyph className="w-[18px] h-[18px]" />}
            </button>
          </Tooltip>
        )}
        {held && !onRemove && <CheckGlyph className="w-4 h-4 shrink-0 text-fg-muted" />}
        {onOpen && (
          <Tooltip label={`Open ${label}`}>
            <button
              onClick={onOpen}
              aria-label={`Open ${label}`}
              className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-fg-muted transition-all duration-150 hover:bg-fg/10 hover:text-fg active:scale-90"
            >
              <PanelRightGlyph className="w-4 h-4" />
            </button>
          </Tooltip>
        )}
        {onRemove && (
          <Tooltip label={`Take ${label} out`} className={hasStableAction ? 'absolute right-full top-0 mr-1' : undefined}>
            <button
              onClick={onRemove}
              aria-label={`Take ${label} out`}
              className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-fg/45 opacity-0 transition-all duration-150 group-hover:opacity-100 hover:bg-danger/10 hover:text-danger active:scale-90 focus-visible:opacity-100"
            >
              <TrashGlyph className="w-4 h-4" />
            </button>
          </Tooltip>
        )}
      </span>
    </div>
  )
}
