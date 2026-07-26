import { isImageType, type Attachment } from '../../../shared/attachments'
import type { SessionEvent } from '../../../shared/events'
import { messageReactionTarget } from '../../../shared/reactions'

const FLASH = 'message-flash'
const FLASH_MS = 520
const SETTLED_FRAMES = 2
const GIVE_UP_FRAMES = 90

export function replyTargetLabel(authorName: string, toSelf: boolean, byMe: boolean): string {
  if (!toSelf) return `Replying to ${authorName}`
  return byMe ? 'Replying to yourself' : 'Replying to you'
}

export function replyImage(events: SessionEvent[], targetId: string | undefined): Attachment | undefined {
  if (!targetId) return undefined
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]
    if (event.kind !== 'message' || messageReactionTarget(event.id) !== targetId) continue
    return event.attachments?.find(attachment => isImageType(attachment.mime))
  }
  return undefined
}

export function jumpToMessage(targetId: string): boolean {
  const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-message]'))
  const row = rows.find(node => node.dataset.message === targetId)
  if (!row) return false
  row.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  whenSettled(row, () => flash(row))
  return true
}

// The flash belongs at the end of the journey, not the start, so it is held
// until the row has stopped moving under the smooth scroll.
function whenSettled(row: HTMLElement, done: () => void): void {
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
    if (still >= SETTLED_FRAMES || frames >= GIVE_UP_FRAMES) {
      done()
      return
    }
    window.requestAnimationFrame(look)
  }
  window.requestAnimationFrame(look)
}

function flash(row: HTMLElement): void {
  row.classList.remove(FLASH)
  void row.offsetWidth
  row.classList.add(FLASH)
  window.setTimeout(() => row.classList.remove(FLASH), FLASH_MS)
}
