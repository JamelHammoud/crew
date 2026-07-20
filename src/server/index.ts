import fs from 'node:fs'
import http from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import { mimeForFile } from '../shared/attachments'
import type { CrewSession } from './session'

export interface CrewServer {
  session: CrewSession
  port: () => number
  close: () => Promise<void>
}

interface CrewServerOptions {
  port?: number
  host?: string
  heartbeatMs?: number
}

type LiveSocket = WebSocket & { isAlive: boolean }

const HEARTBEAT_MS = 20000

function serveAttachment(session: CrewSession, file: string, res: http.ServerResponse): void {
  const full = session.attachmentPath(file)
  const mime = mimeForFile(file)
  if (!full || !mime) {
    res.writeHead(404)
    res.end()
    return
  }
  res.writeHead(200, { 'content-type': mime, 'cache-control': 'public, max-age=31536000, immutable' })
  fs.createReadStream(full)
    .on('error', () => res.end())
    .pipe(res)
}

export function createCrewServer(session: CrewSession, opts: CrewServerOptions = {}): Promise<CrewServer> {
  const httpServer = http.createServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end('crew')
      return
    }
    const attachment = /^\/attachments\/([^/?#]+)$/.exec(req.url ?? '')
    if (attachment) {
      serveAttachment(session, decodeURIComponent(attachment[1]), res)
      return
    }
    res.writeHead(404)
    res.end()
  })

  const wss = new WebSocketServer({ noServer: true })
  const clients = new Set<LiveSocket>()

  httpServer.on('upgrade', (req, socket, head) => {
    if (!req.url?.startsWith('/ws')) {
      socket.destroy()
      return
    }
    wss.handleUpgrade(req, socket, head, ws => {
      const live = ws as LiveSocket
      live.isAlive = true
      ws.on('pong', () => {
        live.isAlive = true
      })
      ws.on('close', () => clients.delete(live))
      clients.add(live)
      session.attach(ws)
    })
  })

  const heartbeat = setInterval(() => {
    for (const ws of clients) {
      if (!ws.isAlive) {
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
  }, opts.heartbeatMs ?? HEARTBEAT_MS)

  return new Promise((resolve, reject) => {
    httpServer.once('error', reject)
    httpServer.listen(opts.port ?? 0, opts.host ?? '0.0.0.0', () => {
      const address = httpServer.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve({
        session,
        port: () => port,
        close: () =>
          new Promise(done => {
            clearInterval(heartbeat)
            for (const ws of clients) ws.terminate()
            httpServer.close(() => done())
          })
      })
    })
  })
}
