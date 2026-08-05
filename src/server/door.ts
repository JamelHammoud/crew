import http from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import { MAX_FRAME_BYTES } from '../shared/protocol'
import { routeCrew } from './routes'
import type { CrewSession } from './session'

export interface DoorOptions {
  port?: number
  host?: string
  heartbeatMs?: number
  autoPong?: boolean
}

type LiveSocket = WebSocket & { isAlive: boolean }

const HEARTBEAT_MS = 20000

export class Door {
  private crews = new Map<string, CrewSession>()
  private clients = new Set<LiveSocket>()
  private beat: NodeJS.Timeout | null = null
  private lastBeat = Date.now()

  constructor(
    private httpServer: http.Server,
    private wss: WebSocketServer,
    private at: { host: string; port: number },
    intervalMs: number
  ) {
    httpServer.on('request', (req, res) => this.serve(req, res))
    httpServer.on('upgrade', (req, socket, head) => this.upgrade(req, socket, head))
    this.beat = setInterval(() => this.sweep(intervalMs), intervalMs)
  }

  // A code is one crew's for as long as it is standing here, and a second crew
  // answering to the same one is the whole of what this refuses. Two of them at
  // one address is two crews that are the same crew to everything reaching one.
  hold(session: CrewSession): boolean {
    const standing = this.crews.get(session.code)
    if (standing && standing !== session) return false
    this.crews.set(session.code, session)
    return true
  }

  drop(session: CrewSession): void {
    if (this.crews.get(session.code) === session) this.crews.delete(session.code)
  }

  holds(code: string): boolean {
    return this.crews.has(code)
  }

  count(): number {
    return this.crews.size
  }

  host(): string {
    return this.at.host
  }

  port(): number {
    return this.at.port
  }

  close(): Promise<void> {
    return new Promise(done => {
      if (this.beat) clearInterval(this.beat)
      this.beat = null
      this.crews.clear()
      for (const ws of this.clients) ws.terminate()
      this.httpServer.close(() => done())
    })
  }

  // The first segment of every path is the crew being reached, so one door can
  // stand in front of every crew on this machine and a guest's address stops
  // moving when somebody opens another project.
  private crewAt(raw: string): { session: CrewSession; rest: string } | null {
    const match = /^\/([a-z0-9]+)(\/.*)?$/i.exec(raw)
    if (!match) return null
    const session = this.crews.get(match[1].toLowerCase())
    return session ? { session, rest: match[2] ?? '/' } : null
  }

  private serve(req: http.IncomingMessage, res: http.ServerResponse): void {
    const raw = req.url ?? ''
    if (raw === '/') {
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end('crew')
      return
    }
    const found = this.crewAt(raw)
    if (found && routeCrew(found.session, found.rest, req, res)) return
    res.writeHead(404)
    res.end()
  }

  private upgrade(req: http.IncomingMessage, socket: NodeJS.WritableStream & { destroy: () => void }, head: Buffer): void {
    const found = this.crewAt(req.url ?? '')
    if (!found || found.rest !== '/ws') {
      socket.destroy()
      return
    }
    const session = found.session
    this.wss.handleUpgrade(req, socket as never, head, ws => {
      const live = ws as LiveSocket
      live.isAlive = true
      ws.on('pong', () => {
        live.isAlive = true
      })
      ws.on('ping', () => {
        live.isAlive = true
      })
      ws.on('message', () => {
        live.isAlive = true
      })
      ws.on('close', () => this.clients.delete(live))
      this.clients.add(live)
      session.attach(ws)
    })
  }

  private sweep(intervalMs: number): void {
    const now = Date.now()
    const stalled = now - this.lastBeat > intervalMs * 3
    this.lastBeat = now
    for (const ws of this.clients) {
      if (!ws.isAlive && !stalled) {
        ws.terminate()
        continue
      }
      ws.isAlive = false
      try {
        ws.ping()
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }))
      } catch {
        ws.terminate()
      }
    }
  }
}

export function openDoor(opts: DoorOptions = {}): Promise<Door> {
  const httpServer = http.createServer()
  const wss = new WebSocketServer({
    noServer: true,
    autoPong: opts.autoPong ?? true,
    maxPayload: MAX_FRAME_BYTES
  })
  return new Promise((resolve, reject) => {
    httpServer.once('error', reject)
    httpServer.listen(opts.port ?? 0, opts.host ?? '0.0.0.0', () => {
      const address = httpServer.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve(new Door(httpServer, wss, { host: opts.host ?? '0.0.0.0', port }, opts.heartbeatMs ?? HEARTBEAT_MS))
    })
  })
}
