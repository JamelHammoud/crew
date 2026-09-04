import fs from 'node:fs'
import http from 'node:http'
import { isAttachmentFile, mimeForFile } from '../shared/attachments'
import { mimeForCustomEmoji } from '../shared/customEmoji'
import { mimeForMusic } from '../shared/music'
import type { DesignOp } from '../shared/design'
import type { CrewSession } from './session'

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
  if (!isAttachmentFile(file)) {
    res.writeHead(404)
    res.end()
    return
  }
  const mime = mimeForFile(file)
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

// An emoji the crew drew themselves, read from everyone's own copy. The name is a
// uuid the host wrote, so there is nothing in it to walk out of the folder with.
function serveCustomEmoji(session: CrewSession, file: string, res: http.ServerResponse): void {
  const full = session.customEmojiPath(file)
  if (!full) {
    res.writeHead(404)
    res.end()
    return
  }
  res.writeHead(200, { 'content-type': mimeForCustomEmoji(file), ...MEDIA_HEADERS })
  fs.createReadStream(full)
    .on('error', () => res.end())
    .pipe(res)
}

function receiveAttachment(session: CrewSession, req: http.IncomingMessage, res: http.ServerResponse): void {
  const mime = (req.headers['content-type'] ?? '').split(';')[0].trim()
  let name = 'file'
  try {
    const header = req.headers['x-attachment-name']
    if (typeof header === 'string') name = decodeURIComponent(header)
  } catch {
    name = 'file'
  }
  const limit = session.attachmentLimit()
  const chunks: Buffer[] = []
  let size = 0
  req.on('data', chunk => {
    size += chunk.length
    if (size <= limit) chunks.push(chunk as Buffer)
  })
  req.on('end', () => {
    if (size > limit) {
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

function receiveDesignOps(
  session: CrewSession,
  boardId: string,
  req: http.IncomingMessage,
  res: http.ServerResponse
): void {
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
function serveAgents(session: CrewSession, raw: string, req: http.IncomingMessage, res: http.ServerResponse): boolean {
  const [url, query = ''] = raw.split('?')
  if (req.method === 'POST' && url === '/agents/spawn') {
    readJson(req, res, MAX_AGENT_BODY, body => {
      const result = session.subagentSpawn(
        said(body, 'promptId'),
        said(body, 'name'),
        said(body, 'subject'),
        said(body, 'task'),
        { provider: said(body, 'provider'), model: said(body, 'model'), notify: body.notify !== false }
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
  if (req.method === 'GET' && url === '/agents') {
    const promptId = new URLSearchParams(query).get('promptId') ?? ''
    const agents = session.subagentList(promptId)
    sendJson(res, agents ? 200 : 404, agents ?? { error: 'That prompt is not a run.' })
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
  const restart = /^\/agents\/([\w-]+)\/restart$/.exec(url)
  if (req.method === 'POST' && restart) {
    readJson(req, res, MAX_AGENT_BODY, body => {
      const ok = session.subagentRestart(said(body, 'promptId'), restart[1])
      sendJson(res, ok ? 200 : 409, ok ? { ok } : { error: 'That helper cannot be run again.' })
    })
    return true
  }
  const look = /^\/agents\/([\w-]+)$/.exec(url)
  if (req.method === 'GET' && look) {
    const promptId = new URLSearchParams(query).get('promptId') ?? ''
    const state = session.subagentLook(promptId, look[1])
    sendJson(res, state ? 200 : 404, state ?? { error: 'No helper of yours with that id.' })
    return true
  }
  return false
}

// The board beside a thread: putting the work up, moving a piece of it, naming
// a decision and raising a question. Every one names the promptId of the run
// asking, the same credential the helpers are reached on, and the thread it
// writes to is read off that run rather than taken from the body.
function serveTickets(session: CrewSession, raw: string, req: http.IncomingMessage, res: http.ServerResponse): boolean {
  const [url] = raw.split('?')
  if (req.method !== 'POST') return false
  if (url === '/tickets') {
    readJson(req, res, MAX_AGENT_BODY, body => {
      const result = session.ticketPut(said(body, 'promptId'), body.tickets)
      sendJson(res, 'error' in result ? 400 : 200, result)
    })
    return true
  }
  // Ahead of the id, or a question would be read as a ticket called question.
  if (url === '/tickets/question') {
    readJson(req, res, MAX_AGENT_BODY, body => {
      const result = session.ticketAsk(said(body, 'promptId'), body)
      sendJson(res, 'error' in result ? 400 : 200, result)
    })
    return true
  }
  // A decision naming no ticket hangs off whatever is on doing, so the id in
  // the path may be empty.
  const decision = /^\/tickets\/([\w-]*)\/decision$/.exec(url)
  if (decision) {
    readJson(req, res, MAX_AGENT_BODY, body => {
      const result = session.ticketDecide(said(body, 'promptId'), decision[1], body.text)
      sendJson(res, 'error' in result ? 404 : 200, result)
    })
    return true
  }
  const move = /^\/tickets\/([\w-]+)$/.exec(url)
  if (move) {
    readJson(req, res, MAX_AGENT_BODY, body => {
      const result = session.ticketMove(said(body, 'promptId'), move[1], body.column, body.note)
      sendJson(res, 'error' in result ? 404 : 200, result)
    })
    return true
  }
  return false
}

function serveMemory(session: CrewSession, raw: string, req: http.IncomingMessage, res: http.ServerResponse): boolean {
  const [url, query = ''] = raw.split('?')
  if (req.method === 'GET' && url === '/memory') {
    const result = session.memoryRead(new URLSearchParams(query).get('promptId') ?? '')
    sendJson(res, 'error' in result ? 400 : 200, result)
    return true
  }
  if (req.method !== 'POST') return false
  if (url === '/memory') {
    readJson(req, res, MAX_AGENT_BODY, body => {
      const result = session.memoryPut(said(body, 'promptId'), body.memories ?? body.text)
      sendJson(res, 'error' in result ? 400 : 200, result)
    })
    return true
  }
  const forget = /^\/memory\/([\w-]+)\/forget$/.exec(url)
  if (forget) {
    readJson(req, res, MAX_AGENT_BODY, body => {
      const result = session.memoryForget(said(body, 'promptId'), forget[1])
      sendJson(res, 'error' in result ? 404 : 200, result)
    })
    return true
  }
  const edit = /^\/memory\/([\w-]+)$/.exec(url)
  if (edit) {
    readJson(req, res, MAX_AGENT_BODY, body => {
      const result = session.memoryEdit(said(body, 'promptId'), edit[1], body.text)
      sendJson(res, 'error' in result ? 404 : 200, result)
    })
    return true
  }
  return false
}

// A page an agent wants on the screen. It names the promptId of the run asking,
// the same credential the board and the helpers are reached on, and the thread
// it opens in is read off that run rather than taken from the body.
function servePage(session: CrewSession, raw: string, req: http.IncomingMessage, res: http.ServerResponse): boolean {
  if (req.method !== 'POST' || raw.split('?')[0] !== '/page') return false
  readJson(req, res, MAX_AGENT_BODY, body => {
    const result = session.showPage(said(body, 'promptId'), body.url, body.title)
    sendJson(res, 'error' in result ? 400 : 200, result)
  })
  return true
}

// The app an agent wants on the simulator. It names the promptId of the run
// asking, the same credential the page and the board are reached on.
function serveIos(session: CrewSession, raw: string, req: http.IncomingMessage, res: http.ServerResponse): boolean {
  if (req.method !== 'POST' || raw.split('?')[0] !== '/ios') return false
  readJson(req, res, MAX_AGENT_BODY, body => {
    const result = session.runIos(said(body, 'promptId'))
    sendJson(res, 'error' in result ? 400 : 200, result)
  })
  return true
}

// Every address into a crew names it, so what reaches here is the rest of the
// path with the code already read off it.
export function routeCrew(
  session: CrewSession,
  raw: string,
  req: http.IncomingMessage,
  res: http.ServerResponse
): boolean {
  if (req.method === 'POST' && raw === '/attachments') {
    receiveAttachment(session, req, res)
    return true
  }
  const attachment = /^\/attachments\/([^/?#]+)$/.exec(raw)
  if (attachment) {
    serveAttachment(session, decodeURIComponent(attachment[1]), res)
    return true
  }
  const music = /^\/music\/([^/?#]+)$/.exec(raw)
  if (music) {
    serveMusic(session, decodeURIComponent(music[1]), res)
    return true
  }
  const emoji = /^\/emoji\/([^/?#]+)$/.exec(raw)
  if (emoji) {
    serveCustomEmoji(session, decodeURIComponent(emoji[1]), res)
    return true
  }
  if (serveAgents(session, raw, req, res)) return true
  if (serveTickets(session, raw, req, res)) return true
  if (serveMemory(session, raw, req, res)) return true
  if (servePage(session, raw, req, res)) return true
  if (serveIos(session, raw, req, res)) return true
  const designOps = /^\/design\/([a-z0-9][a-z0-9-]*)\/ops$/.exec(raw)
  if (req.method === 'POST' && designOps) {
    receiveDesignOps(session, designOps[1], req, res)
    return true
  }
  const designRead = /^\/design\/([a-z0-9][a-z0-9-]*)$/.exec(raw)
  if (req.method === 'GET' && designRead) {
    const summary = session.designBoardSummary(designRead[1])
    sendJson(res, summary ? 200 : 404, summary ?? { error: 'No board with that id' })
    return true
  }
  return false
}
