import fs from 'node:fs'
import http from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import { MAX_ATTACHMENT_BYTES, mimeForFile } from '../shared/attachments'
import { mimeForMusic } from '../shared/music'
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

// A picture in a message is drawn by an img tag, which the browser will take
// from anywhere. A track is read with fetch, and the answer to a fetch is not
// handed to the page unless the host says who may read it, so a run from source,
// where the app is served on a port of its own, was told nothing at all and
// played silence. Only the media a member reads says this. The routes that write
// stay shut, or a page in somebody's browser could reach them.
const MEDIA_HEADERS = {
  'cache-control': 'public, max-age=31536000, immutable',
  'access-control-allow-origin': '*'
}

function serveAttachment(session: CrewSession, file: string, res: http.ServerResponse): void {
  const mime = mimeForFile(file)
  if (!mime) {
    res.writeHead(404)
    res.end()
    return
  }
  // A picture in a ghost thread was never written down, so it is answered from
  // memory. Everything else is a file beside the session.
  const held = session.attachmentBytes(file)
  if (held) {
    res.writeHead(200, { 'content-type': mime, ...MEDIA_HEADERS })
    res.end(held)
    return
  }
  const full = session.attachmentPath(file)
  if (!full) {
    res.writeHead(404)
    res.end()
    return
  }
  res.writeHead(200, { 'content-type': mime, ...MEDIA_HEADERS })
  fs.createReadStream(full)
    .on('error', () => res.end())
    .pipe(res)
}

// A track the crew put there themselves, played from everyone's own copy. The
// name is a uuid the host wrote, so there is nothing in it to walk out of the
// folder with.
function serveMusic(session: CrewSession, file: string, res: http.ServerResponse): void {
  const full = session.musicPath(file)
  if (!full) {
    res.writeHead(404)
    res.end()
    return
  }
  res.writeHead(200, { 'content-type': mimeForMusic(file), ...MEDIA_HEADERS })
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
const MAX_AGENT_BODY = 256 * 1024
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

function readJson(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  limit: number,
  then: (body: Record<string, unknown>) => void
): void {
  const chunks: Buffer[] = []
  let size = 0
  req.on('data', chunk => {
    size += chunk.length
    if (size <= limit) chunks.push(chunk as Buffer)
  })
  req.on('end', () => {
    if (size > limit) {
      sendJson(res, 413, { error: 'Body too large' })
      return
    }
    try {
      const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if (!parsed || typeof parsed !== 'object') throw new Error('not an object')
      then(parsed as Record<string, unknown>)
    } catch {
      sendJson(res, 400, { error: 'Body must be a JSON object' })
    }
  })
  req.on('error', () => {
    res.writeHead(400)
    res.end()
  })
}

const said = (body: Record<string, unknown>, key: string): string =>
  typeof body[key] === 'string' ? (body[key] as string) : ''

// Sending a helper out, talking to one, and looking at where it has got to.
// Every one of them names the promptId of the run asking, and the session takes
// it only while that run is one it has going.
function serveAgents(session: CrewSession, url: string, req: http.IncomingMessage, res: http.ServerResponse): boolean {
  if (req.method === 'POST' && url === '/agents/spawn') {
    readJson(req, res, MAX_AGENT_BODY, body => {
      const result = session.subagentSpawn(
        said(body, 'promptId'),
        said(body, 'role'),
        said(body, 'subject'),
        said(body, 'task'),
        body.notify !== false
      )
      sendJson(res, 'error' in result ? 400 : 200, result)
    })
    return true
  }
  if (req.method === 'POST' && url === '/agents/wait') {
    readJson(req, res, MAX_AGENT_BODY, body => {
      const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string') : []
      const ms = typeof body.ms === 'number' ? body.ms : 0
      void session.subagentWait(said(body, 'promptId'), ids, ms).then(answer => sendJson(res, 200, answer))
    })
    return true
  }
  const say = /^\/agents\/([\w-]+)\/say$/.exec(url)
  if (req.method === 'POST' && say) {
    readJson(req, res, MAX_AGENT_BODY, body => {
      const ok = session.subagentSay(said(body, 'promptId'), say[1], said(body, 'text'))
      sendJson(res, ok ? 200 : 404, ok ? { ok } : { error: 'No helper of yours with that id.' })
    })
    return true
  }
  const stop = /^\/agents\/([\w-]+)\/stop$/.exec(url)
  if (req.method === 'POST' && stop) {
    readJson(req, res, MAX_AGENT_BODY, body => {
      const ok = session.subagentStop(said(body, 'promptId'), stop[1])
      sendJson(res, ok ? 200 : 404, ok ? { ok } : { error: 'No helper of yours with that id.' })
    })
    return true
  }
  const look = /^\/agents\/([\w-]+)$/.exec(url)
  if (req.method === 'GET' && look) {
    const state = session.subagentLook(said(Object.fromEntries(new URL(url, 'http://x').searchParams), 'promptId'), look[1])
    sendJson(res, state ? 200 : 404, state ?? { error: 'No helper of yours with that id.' })
    return true
  }
  return false
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
    const music = /^\/music\/([^/?#]+)$/.exec(req.url ?? '')
    if (music) {
      serveMusic(session, decodeURIComponent(music[1]), res)
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
