import fs from 'node:fs'
import http from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import { MAX_ATTACHMENT_BYTES, mimeForFile } from '../shared/attachments'
import type { DesignOp } from '../shared/design'
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
  autoPong?: boolean
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

function receiveAttachment(session: CrewSession, req: http.IncomingMessage, res: http.ServerResponse): void {
  const mime = (req.headers['content-type'] ?? '').split(';')[0].trim()
  let name = 'image'
  try {
    const header = req.headers['x-attachment-name']
    if (typeof header === 'string') name = decodeURIComponent(header)
  } catch {
    name = 'image'
  }
  const chunks: Buffer[] = []
  let size = 0
  req.on('data', chunk => {
    size += chunk.length
    if (size <= MAX_ATTACHMENT_BYTES) chunks.push(chunk as Buffer)
  })
  req.on('end', () => {
    if (size > MAX_ATTACHMENT_BYTES) {
      res.writeHead(413)
      res.end()
      return
    }
    const saved = session.saveAttachment(mime, name, Buffer.concat(chunks))
    if (!saved) {
      res.writeHead(400)
      res.end()
      return
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(saved))
  })
  req.on('error', () => {
    res.writeHead(400)
    res.end()
  })
}

const MAX_DESIGN_BODY = 4 * 1024 * 1024
const MAX_DESIGN_OPS = 200
const JSON_HEADERS = { 'content-type': 'application/json' }

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, JSON_HEADERS)
  res.end(JSON.stringify(body))
}

function receiveDesignOps(session: CrewSession, boardId: string, req: http.IncomingMessage, res: http.ServerResponse): void {
  const chunks: Buffer[] = []
  let size = 0
  req.on('data', chunk => {
    size += chunk.length
    if (size <= MAX_DESIGN_BODY) chunks.push(chunk as Buffer)
  })
  req.on('end', () => {
    if (size > MAX_DESIGN_BODY) {
      sendJson(res, 413, { error: 'Body too large' })
      return
    }
    let parsed: { agent?: unknown; ops?: unknown }
    try {
      parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } catch {
      sendJson(res, 400, { error: 'Body must be JSON like {"agent":"...","ops":[...]}' })
      return
    }
    const ops = Array.isArray(parsed.ops) ? (parsed.ops as DesignOp[]) : null
    if (!ops || ops.length === 0) {
      sendJson(res, 400, { error: 'ops must be a non-empty array' })
      return
    }
    if (ops.length > MAX_DESIGN_OPS) {
      sendJson(res, 400, { error: `Send at most ${MAX_DESIGN_OPS} ops per batch` })
      return
    }
    const agent = typeof parsed.agent === 'string' && parsed.agent ? parsed.agent.slice(0, 120) : 'agent'
    const results = session.runDesignOps(boardId, agent, ops)
    if (!results) {
      sendJson(res, 404, { error: 'No board with that id' })
      return
    }
    sendJson(res, 200, { results })
  })
  req.on('error', () => {
    res.writeHead(400)
    res.end()
  })
}

export function createCrewServer(session: CrewSession, opts: CrewServerOptions = {}): Promise<CrewServer> {
  const httpServer = http.createServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end('crew')
      return
    }
    if (req.method === 'POST' && req.url === '/attachments') {
      receiveAttachment(session, req, res)
      return
    }
    const attachment = /^\/attachments\/([^/?#]+)$/.exec(req.url ?? '')
    if (attachment) {
      serveAttachment(session, decodeURIComponent(attachment[1]), res)
      return
    }
    const designOps = /^\/design\/([a-z0-9][a-z0-9-]*)\/ops$/.exec(req.url ?? '')
    if (req.method === 'POST' && designOps) {
      receiveDesignOps(session, designOps[1], req, res)
      return
    }
    const designRead = /^\/design\/([a-z0-9][a-z0-9-]*)$/.exec(req.url ?? '')
    if (req.method === 'GET' && designRead) {
      const summary = session.designBoardSummary(designRead[1])
      if (!summary) {
        sendJson(res, 404, { error: 'No board with that id' })
        return
      }
      sendJson(res, 200, summary)
      return
    }
    res.writeHead(404)
    res.end()
  })

  const wss = new WebSocketServer({ noServer: true, autoPong: opts.autoPong ?? true })
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
      ws.on('ping', () => {
        live.isAlive = true
      })
      ws.on('message', () => {
        live.isAlive = true
      })
      ws.on('close', () => clients.delete(live))
      clients.add(live)
      session.attach(ws)
    })
  })

  const intervalMs = opts.heartbeatMs ?? HEARTBEAT_MS
  let lastBeat = Date.now()
  const heartbeat = setInterval(() => {
    const now = Date.now()
    const stalled = now - lastBeat > intervalMs * 3
    lastBeat = now
    for (const ws of clients) {
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
