import { useState, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircleGlyph, WarningGlyph } from '../icons'
import { closeToast, holdToasts, useToasts, type Toast, type ToastTone } from '../state/toast'
import { MenuItem, Popover } from './Popover'
import Spinner from './Spinner'
import { TOP_BAR_H } from './TopBar'
import { useSwipeAway } from './useSwipeAway'

function markFor(tone: ToastTone): ReactNode {
  if (tone === 'done') return <CheckCircleGlyph className="text-positive" />
  if (tone === 'fail') return <WarningGlyph className="text-danger" />
  if (tone === 'busy') return <Spinner size={16} className="text-fg/70" />
  return null
}

function Row({ toast }: { toast: Toast }) {
  const mark = toast.mark ?? markFor(toast.tone)
  const action = toast.action
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)
  // A row is pushed out of the way to the right, and what was a gesture is never
  // a press as well.
  const swipe = useSwipeAway(() => closeToast(toast.id))

  // The whole row is the way into what it is about, the way a banner is, so the
  // button on it says what a press does rather than being the one place that
  // does it. A row with nothing to open has only the one thing a press can do,
  // which is take it away, and the swipe is the way out of either.
  const press = (): void => {
    if (swipe.moved()) return
    action?.onPress()
    if (!action?.keep) closeToast(toast.id)
  }

  const openMenu = (event: MouseEvent): void => {
    if (!action?.menu?.length) return
    event.preventDefault()
    setMenuAt({ x: event.clientX, y: event.clientY })
  }

  const takeMenuAction = (onPress: () => void): void => {
    setMenuAt(null)
    onPress()
    if (!action?.keep) closeToast(toast.id)
  }

  return (
    <div className="toast-row" data-leaving={toast.leaving ? '' : undefined}>
      <div
        {...swipe.props}
        role={toast.tone === 'fail' ? 'alert' : 'status'}
        onClick={press}
        onContextMenu={openMenu}
        className={`glass glass-strong toast-card pointer-events-auto cursor-pointer touch-none w-80 flex items-center gap-2.5 rounded-2xl py-2.5 ${
          action ? 'pl-3.5 pr-2' : 'px-3.5'
        }`}
      >
        {mark && (
          <span className="shrink-0 flex items-center justify-center w-5 h-5 [&>svg]:w-[18px] [&>svg]:h-[18px]">
            {mark}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-fg">{toast.text}</p>
          {toast.detail && <p className="text-xs text-fg/45 mt-0.5 line-clamp-2">{toast.detail}</p>}
        </div>
        {action && (
          <button className="shrink-0 h-7 px-3 rounded-full text-xs font-semibold text-fg bg-fg/10 hover:bg-fg/[0.14] transition-colors active:scale-95">
            {action.label}
          </button>
        )}
      </div>
      <Popover open={menuAt !== null} onClose={() => setMenuAt(null)} at={menuAt ?? undefined} className="min-w-52">
        {action?.menu?.map(item => (
          <MenuItem
            key={item.label}
            icon={item.mark}
            label={item.label}
            onClick={() => takeMenuAction(item.onPress)}
          />
        ))}
      </Popover>
    </div>
  )
}

// The stack stands in the body rather than where it was written, so a word about
// something that happened in a panel, a menu or a board lands in the same corner
// as every other one. It sits under the header and clear of the popovers that
// open in that corner, which are what somebody is aiming at when one is open.
export default function Toaster() {
  const toasts = useToasts()
  if (toasts.length === 0) return null

  return createPortal(
    <div
      style={{ top: TOP_BAR_H, right: 24 }}
      onPointerEnter={() => holdToasts(true)}
      onPointerLeave={() => holdToasts(false)}
      className="fixed z-[45] pt-2 flex flex-col items-end pointer-events-none"
    >
      {toasts.map(toast => (
        <Row key={toast.id} toast={toast} />
      ))}
    </div>,
    document.body
  )
}
