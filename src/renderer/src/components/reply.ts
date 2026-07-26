const FLASH = 'animate-flash'

export function replyTargetLabel(authorName: string, toSelf: boolean, byMe: boolean): string {
  if (!toSelf) return `Replying to ${authorName}`
  return byMe ? 'Replying to yourself' : 'Replying to you'
}

export function jumpToMessage(targetId: string): boolean {
  const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-message]'))
  const row = rows.find(node => node.dataset.message === targetId)
  if (!row) return false
  row.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  row.classList.remove(FLASH)
  void row.offsetWidth
  row.classList.add(FLASH)
  window.setTimeout(() => row.classList.remove(FLASH), 1400)
  return true
}
