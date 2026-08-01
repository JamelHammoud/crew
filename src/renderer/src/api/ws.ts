import type { ClientMessage, ServerMessage } from '../../../shared/protocol'

export type SocketStatus = 'connecting' | 'open' | 'closed'

const MAX_DELAY_MS = 10000
const SILENCE_TIMEOUT_MS = 60000

export class CrewSocket {
  private ws: WebSocket | null = null
  private hello: ClientMessage | null = null
  private url = ''
  private attempts = 0
  private intentionalClose = false
  private reconnectTimer: number | null = null
  private pending: ClientMessage[] = []
  private lastSeen = 0
  private watchdog: number | null = null
  onMessage: (msg: ServerMessage) => void = () => {}
  onStatus: (status: SocketStatus) => void = () => {}

  connect(url: string, hello: ClientMessage): void {
    const previous = this.ws
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    this.url = url
    this.hello = hello
    this.intentionalClose = false
    this.attempts = 0
    this.open()
    previous?.close()
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    } else if (!this.intentionalClose) {
      this.pending.push(msg)
    }
  }

  close(): void {
    this.intentionalClose = true
    this.pending = []
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer)
    if (this.watchdog !== null) window.clearInterval(this.watchdog)
    this.reconnectTimer = null
    this.watchdog = null
    this.ws?.close()
  }

  private open(): void {
    this.onStatus('connecting')
    const ws = new WebSocket(this.url)
    this.ws = ws
    this.lastSeen = Date.now()
    ws.onopen = () => {
      if (this.ws !== ws) return
      this.attempts = 0
      this.lastSeen = Date.now()
      if (this.hello) ws.send(JSON.stringify(this.hello))
      this.onStatus('open')
      const queued = this.pending
      this.pending = []
      for (const msg of queued) this.send(msg)
    }
    ws.onmessage = event => {
      if (this.ws !== ws) return
      this.lastSeen = Date.now()
      try {
        this.onMessage(JSON.parse(event.data))
      } catch {
        return
      }
    }
    ws.onclose = () => {
      if (this.ws !== ws) return
      if (this.watchdog !== null) window.clearInterval(this.watchdog)
      this.watchdog = null
      this.onStatus('closed')
      if (this.intentionalClose) return
      const wait = Math.min(1000 * 2 ** this.attempts, MAX_DELAY_MS)
      this.attempts++
      this.reconnectTimer = window.setTimeout(() => {
        this.reconnectTimer = null
        this.open()
      }, wait)
    }
    ws.onerror = () => ws.close()
    if (this.watchdog !== null) window.clearInterval(this.watchdog)
    this.watchdog = window.setInterval(() => {
      if (this.ws !== ws) return
      if (Date.now() - this.lastSeen > SILENCE_TIMEOUT_MS) ws.close()
    }, 10000)
  }
}
