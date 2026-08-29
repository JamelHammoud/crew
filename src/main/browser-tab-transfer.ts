import type { BrowserTab } from '../shared/browserTab'

export type BrowserTabTransferContents = {
  id: number
  isDestroyed(): boolean
  send(channel: string, ...args: unknown[]): void
}

type HeldTab = {
  source: BrowserTabTransferContents
  tab: BrowserTab
  copy: boolean
  expires: ReturnType<typeof setTimeout>
}

export class BrowserTabTransfers {
  private held = new Map<string, HeldTab>()

  constructor(private placeFor: (id: number) => string | null) {}

  begin(source: BrowserTabTransferContents, token: string, tab: BrowserTab, copy = false): boolean {
    if (!token || token.length > 200 || source.isDestroyed()) return false
    const existing = this.held.get(token)
    if (existing) clearTimeout(existing.expires)
    const expires = setTimeout(() => this.held.delete(token), 60_000)
    this.held.set(token, { source, tab, copy, expires })
    return true
  }

  drop(target: BrowserTabTransferContents, token: string, to: number): boolean {
    const transfer = this.held.get(token)
    if (!transfer) return false
    clearTimeout(transfer.expires)
    this.held.delete(token)
    if (transfer.source.isDestroyed() || target.isDestroyed()) return false
    const sourcePlace = this.placeFor(transfer.source.id)
    if (!sourcePlace || sourcePlace !== this.placeFor(target.id)) return false
    const index = Number.isFinite(to) ? Math.max(0, Math.floor(to)) : 0
    if (transfer.source.id === target.id && !transfer.copy) {
      target.send('browser:move-tab', transfer.tab.id, index)
      return true
    }
    target.send('browser:insert-tab', transfer.tab, index)
    if (!transfer.copy) transfer.source.send('browser:remove-tab', transfer.tab.id)
    return true
  }
}
