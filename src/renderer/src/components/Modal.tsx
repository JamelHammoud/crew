import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

// A card the app puts in front of everything, for the one thing it is asking
// about. It stands in the body rather than where it was written, so a dialog
// opened from inside a menu, a row or a panel is not clipped by it and does not
// go down with it.
export default function Modal({
  open,
  onClose,
  title,
  width,
  flush,
  className = '',
  children
}: {
  open: boolean
  onClose: () => void
  title: string
  // How wide the card may grow, for one that is not the size a question is. It
  // is a number rather than a class, because a second max width written beside
  // the one the card already wears is settled by the order Tailwind happened to
  // write them in.
  width?: number
  // A card that holds its own padding and draws its own heading, like a page
  // with a rail down the side of it.
  flush?: boolean
  className?: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const keys = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', keys, true)
    return () => window.removeEventListener('keydown', keys, true)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/50 light:bg-black/25" onClick={onClose} />
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        className={`glass relative w-full max-w-md rounded-card p-6 animate-pop ${className}`}
      >
        <h3 className="text-base font-semibold text-fg">{title}</h3>
        {children}
      </div>
    </div>,
    document.body
  )
}
