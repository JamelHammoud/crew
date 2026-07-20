import type { ClientMessage, ServerMessage } from '../../../shared/protocol'

export type SocketStatus = 'connecting' | 'open' | 'closed'

const MAX_DELAY_MS = 10000

export class CrewSocket {
  private ws: WebSocket | null = null
  private hello: ClientMessage | null = null
  private url = ''
  private attempts = 0
  private intentionalClose = false
  private reconnectTimer: number | null = null
  onMessage: (msg: ServerMessage) => void = () => {}
  onStatus: (status: SocketStatus) => void = () => {}

  connect(url: string, hello: ClientMessage): void {
    this.url = url
    this.hello = hello
    this.intentionalClose = false
    this.attempts = 0
    this.open()
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg))
  }

  close(): void {
    this.intentionalClose = true
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer)
    this.ws?.close()
  }

  private open(): void {
    this.onStatus('connecting')
    const ws = new WebSocket(this.url)
    this.ws = ws
    ws.onopen = () => {
      this.attempts = 0
      if (this.hello) ws.send(JSON.stringify(this.hello))
      this.onStatus('open')
    }
    ws.onmessage = event => {
      try {
        this.onMessage(JSON.parse(event.data))
      } catch {
        return
      }
    }
    ws.onclose = () => {
      this.onStatus('closed')
      if (this.intentionalClose) return
      const wait = Math.min(1000 * 2 ** this.attempts, MAX_DELAY_MS)
      this.attempts++
      this.reconnectTimer = window.setTimeout(() => this.open(), wait)
    }
    ws.onerror = () => ws.close()
  }
}
