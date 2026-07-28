import type { MouseEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircleGlyph, WarningGlyph } from '../icons'
import { closeToast, holdToasts, useToasts, type Toast, type ToastTone } from '../state/toast'
import Spinner from './Spinner'
import { TOP_BAR_H } from './TopBar'

function markFor(tone: ToastTone): ReactNode {
  if (tone === 'done') return <CheckCircleGlyph className="text-positive" />
  if (tone === 'fail') return <WarningGlyph className="text-danger" />
  if (tone === 'busy') return <Spinner size={16} className="text-fg/70" />
  return null
}

function Row({ toast }: { toast: Toast }) {
  const mark = toast.mark ?? markFor(toast.tone)
  const action = toast.action

  // The row itself is the way out, so a press on the button is the button's own
  // rather than that as well.
  const press = (event: MouseEvent): void => {
    event.stopPropagation()
    action?.onPress()
    if (!action?.keep) closeToast(toast.id)
  }

  return (
    <div className="toast-row" data-leaving={toast.leaving ? '' : undefined}>
      <div
        role={toast.tone === 'fail' ? 'alert' : 'status'}
        onClick={() => closeToast(toast.id)}
        className={`glass glass-strong toast-card pointer-events-auto cursor-pointer w-80 flex items-center gap-2.5 rounded-2xl py-2.5 ${
          action ? 'pl-3.5 pr-2' : 'px-3.5'
        }`}
      >
        {mark && (
          <span className="shrink-0 flex items-center justify-center w-[18px] h-[18px] [&>svg]:w-[18px] [&>svg]:h-[18px]">
            {mark}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-fg">{toast.text}</p>
          {toast.detail && <p className="text-xs text-fg/45 mt-0.5">{toast.detail}</p>}
        </div>
        {action && (
          <button
            onClick={press}
            className="shrink-0 h-7 px-3 rounded-full text-xs font-semibold text-fg bg-fg/10 hover:bg-fg/[0.14] transition-colors active:scale-95"
          >
            {action.label}
          </button>
        )}
      </div>
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
