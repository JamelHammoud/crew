import type { Attachment } from '../../../shared/attachments'
import type { SessionEvent } from '../../../shared/events'
import { eventIndex } from './eventIndex'

const FLASH = 'message-flash'
const FLASH_MS = 520
const SETTLED_FRAMES = 2
const GIVE_UP_FRAMES = 90
const SHOWN = 0.6

export function replyTargetLabel(authorName: string, toSelf: boolean, byMe: boolean): string {
  if (!toSelf) return `Replying to ${authorName}`
  return byMe ? 'Replying to yourself' : 'Replying to you'
}

// One thing off the message being replied to, and a picture is the one worth
// showing, so it wins over a file that came with it.
export function replyAttachment(events: SessionEvent[], targetId: string | undefined): Attachment | undefined {
  if (!targetId) return undefined
  return eventIndex(events).replyAttachments.get(targetId)
}

export function jumpToMessage(targetId: string): boolean {
  const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-message]'))
  const row = rows.find(node => node.dataset.message === targetId)
  if (!row) return false
  centerIn(row, null, 'smooth')
  whenArrived(row, () => flash(row))
  return true
}

// The flash belongs at the end of the journey, not the start, so it is held
// until the row is in view and has stopped moving under the smooth scroll.
// Stillness alone is not arrival: a smooth scroll takes a frame or two to set
// off, and the row is nowhere near the view for those.
function whenArrived(row: HTMLElement, done: () => void): void {
  if (typeof window.requestAnimationFrame !== 'function') {
    done()
    return
  }
  let last = row.getBoundingClientRect().top
  let still = 0
  let frames = 0
  const look = (): void => {
    const top = row.getBoundingClientRect().top
    still = Math.abs(top - last) < 0.5 ? still + 1 : 0
    last = top
    frames += 1
    const here = shownOf(row) >= SHOWN
    if (here && still >= SETTLED_FRAMES) {
      done()
      return
    }
    if (frames >= GIVE_UP_FRAMES) {
      if (here) done()
      return
    }
    window.requestAnimationFrame(look)
  }
  window.requestAnimationFrame(look)
}

function shownOf(row: HTMLElement): number {
  const rect = row.getBoundingClientRect()
  const view = viewOf(row)
  if (rect.height <= 0 || view.height <= 0) return 1
  const seen = Math.min(rect.bottom, view.bottom) - Math.max(rect.top, view.top)
  return Math.max(0, seen) / Math.min(rect.height, view.height)
}

function viewOf(row: HTMLElement): { top: number; bottom: number; height: number } {
  for (let node = row.parentElement; node; node = node.parentElement) {
    const overflow = window.getComputedStyle?.(node)?.overflowY
    if (overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') {
      return node.getBoundingClientRect()
    }
  }
  const height = window.innerHeight || 0
  return { top: 0, bottom: height, height }
}

function flash(row: HTMLElement): void {
  row.classList.remove(FLASH)
  void row.offsetWidth
  row.classList.add(FLASH)
  window.setTimeout(() => row.classList.remove(FLASH), FLASH_MS)
}
