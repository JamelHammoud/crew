import http from 'node:http'
import { WebSocketServer } from 'ws'
import type { CrewSession } from './session'

export interface CrewServer {
  session: CrewSession
  port: () => number
  close: () => Promise<void>
}

const HEARTBEAT_MS = 25000

export function createCrewServer(session: CrewSession, opts: { port?: number; host?: string } = {}): Promise<CrewServer> {
  const httpServer = http.createServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end('crew')
      return
    }
    res.writeHead(404)
    res.end()
  })

  const wss = new WebSocketServer({ noServer: true })
  httpServer.on('upgrade', (req, socket, head) => {
    if (!req.url?.startsWith('/ws')) {
      socket.destroy()
      return
    }
    wss.handleUpgrade(req, socket, head, ws => session.attach(ws))
  })

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      const alive = ws as unknown as { isAlive?: boolean }
      if (alive.isAlive === false) {
        ws.terminate()
        continue
      }
      alive.isAlive = false
      ws.ping()
    }
  }, HEARTBEAT_MS)

  wss.on('connection', ws => {
    ;(ws as unknown as { isAlive?: boolean }).isAlive = true
    ws.on('pong', () => {
      ;(ws as unknown as { isAlive?: boolean }).isAlive = true
    })
  })

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
            for (const ws of wss.clients) ws.terminate()
            httpServer.close(() => done())
          })
      })
    })
  })
}
