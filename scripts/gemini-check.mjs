import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const TASK =
  'Read notes.txt and think about what is already in it. Then add a line saying "third" to the end of it, keeping the two lines that are there. Then reply with a sentence or two saying what you did.'

const NOTES = 'first\nsecond\n'
const LIMIT = 240000

function binary() {
  return process.env.CREW_GEMINI || 'gemini'
}

function flat(text) {
  return String(text).replace(/\s+/g, ' ').trim()
}

function secs(ms) {
  return (ms / 1000).toFixed(2)
}

function diffsIn(step) {
  const parts = Array.isArray(step?.content) ? step.content : []
  const out = []
  for (const part of parts) {
    const one = part?.type === 'diff' ? part : part?.content?.type === 'diff' ? part.content : null
    if (!one) continue
    if (typeof one.path !== 'string' || !one.path) continue
    if (one.oldText === undefined || one.newText === undefined) continue
    out.push(one)
  }
  return out
}

class Refused extends Error {
  constructor(method, error) {
    super(`${method} refused: ${JSON.stringify(error)}`)
    this.method = method
    this.rpc = error
  }
}

function absent(error) {
  return error?.code === 'ENOENT' || / ENOENT/.test(String(error?.message ?? ''))
}

function unsigned(error) {
  const said = String(error?.rpc?.message ?? '')
  return /api key|not configured|credential|not authenticated|not logged|sign in|oauth/i.test(said)
}

const dir = await mkdtemp(path.join(tmpdir(), 'crew-gemini-'))
const work = path.join(dir, 'work')
let child = null
let killer = null

function stop() {
  if (killer) clearTimeout(killer)
  if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
}

try {
  await mkdir(work, { recursive: true })
  await writeFile(path.join(work, 'notes.txt'), NOTES)

  const started = Date.now()
  const at = () => ((Date.now() - started) / 1000).toFixed(2).padStart(6)

  child = spawn(binary(), ['--acp', '--yolo'], { cwd: work, stdio: ['pipe', 'pipe', 'pipe'] })

  const kinds = new Map()
  const calls = new Map()
  const updates = []
  const thoughts = []
  const messages = []
  const waiting = new Map()
  let next = 1
  let rest = ''
  let stderr = ''
  let gone = null
  let thoughtAt = 0

  killer = setTimeout(() => {
    gone = new Error(`nothing came back within ${LIMIT / 1000}s`)
    for (const [, seat] of waiting) seat.reject(gone)
    waiting.clear()
    stop()
  }, LIMIT)

  const send = message => {
    if (child.stdin.writable) child.stdin.write(`${JSON.stringify(message)}\n`)
  }

  const ask = (method, params) => {
    const id = next++
    return new Promise((resolve, reject) => {
      waiting.set(id, { resolve, reject, method })
      send({ jsonrpc: '2.0', id, method, params })
    })
  }

  const answer = message => {
    if (message.method !== 'session/request_permission') {
      send({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'method not found' } })
      return
    }
    const options = message.params?.options ?? []
    const picked =
      options.find(o => o.kind === 'allow_always') ??
      options.find(o => o.kind === 'allow_once') ??
      options[0]
    console.log(`${at()} permission ${flat(message.params?.toolCall?.title ?? '')} answered ${picked?.optionId ?? 'nothing'}`)
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: { outcome: { outcome: 'selected', optionId: picked?.optionId ?? 'proceed_once' } }
    })
  }

  const update = params => {
    const step = params?.update ?? {}
    const kind = step.sessionUpdate ?? 'unknown'
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1)
    if (kind === 'agent_thought_chunk') {
      const text = step.content?.text ?? ''
      thoughts.push(text)
      if (text.trim() && !thoughtAt) thoughtAt = Date.now()
      if (text.trim()) console.log(`${at()} thinking  ${flat(text).slice(0, 70)}`)
    } else if (kind === 'agent_message_chunk') {
      const text = step.content?.text ?? ''
      messages.push(text)
      if (text.trim()) console.log(`${at()} answer    ${flat(text).slice(0, 70)}`)
    } else if (kind === 'tool_call') {
      calls.set(step.toolCallId, { title: step.title ?? '', kind: step.kind ?? '', status: step.status ?? '' })
      console.log(`${at()} tool      ${step.title ?? ''} (${step.kind ?? ''}) ${step.status ?? ''}`)
    } else if (kind === 'tool_call_update') {
      updates.push(step)
      const seat = calls.get(step.toolCallId)
      const found = diffsIn(step)
      const marks = found.length ? `diff ${found.map(one => one.path).join(', ')}` : ''
      console.log(`${at()} update    ${seat?.title ?? step.toolCallId} ${step.status ?? ''} ${marks}`)
    } else {
      console.log(`${at()} ${kind}`)
    }
  }

  const landed = message => {
    if (message.method && message.id !== undefined) {
      answer(message)
      return
    }
    if (message.method === 'session/update') {
      update(message.params)
      return
    }
    if (message.method) return
    const seat = waiting.get(message.id)
    if (!seat) return
    waiting.delete(message.id)
    if (message.error) seat.reject(new Refused(seat.method, message.error))
    else seat.resolve(message.result)
  }

  child.stdout.setEncoding('utf8')
  child.stdout.on('data', chunk => {
    rest += chunk
    const lines = rest.split('\n')
    rest = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        landed(JSON.parse(line))
      } catch {
        console.log(`${at()} unread    ${flat(line).slice(0, 90)}`)
      }
    }
  })
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', chunk => {
    stderr += chunk
  })
  child.on('error', error => {
    gone = error
    for (const [, seat] of waiting) seat.reject(error)
    waiting.clear()
  })
  child.on('exit', code => {
    const dead = gone ?? new Error(`the CLI stopped with code ${code}${stderr ? `: ${flat(stderr).slice(0, 200)}` : ''}`)
    for (const [, seat] of waiting) seat.reject(dead)
    waiting.clear()
  })

  await ask('initialize', {
    protocolVersion: 1,
    clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false }
  })
  console.log(`${at()} ready`)

  const session = await ask('session/new', { cwd: work, mcpServers: [] })
  console.log(`${at()} session   ${session.sessionId}`)

  const turn = await ask('session/prompt', {
    sessionId: session.sessionId,
    prompt: [{ type: 'text', text: TASK }]
  })
  const endedAt = Date.now()
  console.log(`${at()} stopped   ${turn?.stopReason ?? 'nothing'}`)

  child.stdin.end()
  await new Promise(resolve => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve()
    const late = setTimeout(() => {
      child.kill('SIGKILL')
      resolve()
    }, 5000)
    child.on('exit', () => {
      clearTimeout(late)
      resolve()
    })
  })

  const after = await readFile(path.join(work, 'notes.txt'), 'utf8')
  const said = thoughts.filter(t => t.trim())
  const wrote = messages.filter(t => t.trim())
  const named = [...calls.values()].filter(c => c.title.trim() && c.kind.trim())
  const diffs = updates.flatMap(diffsIn)
  const carried = updates.filter(u => Array.isArray(u.content) && u.content.length).length

  const checks = [
    {
      name: 'thinking arrived while the work was still going',
      ok: said.length > 0 && thoughtAt > 0 && thoughtAt < endedAt,
      note: said.length
        ? `${said.length} chunks, ${said.join('').length} characters, first at ${secs(thoughtAt - started)}s with the turn ending at ${secs(endedAt - started)}s`
        : 'no agent_thought_chunk arrived at all'
    },
    {
      name: 'the answer streamed rather than arriving whole',
      ok: wrote.length > 1,
      note: `${wrote.length} agent_message_chunk updates, ${wrote.join('').length} characters`
    },
    {
      name: 'a tool was named with a title and a kind',
      ok: named.length > 0,
      note: named.length
        ? named.map(c => `${c.title} (${c.kind})`).join(', ')
        : calls.size
          ? `${calls.size} tool calls arrived, none of them carrying both a title and a kind`
          : 'no tool_call arrived'
    },
    {
      name: 'a real diff came through',
      ok: diffs.length > 0,
      note: diffs.length
        ? diffs
            .map(one => `${one.path} ${String(one.oldText ?? '').length} characters to ${String(one.newText ?? '').length}`)
            .join(', ')
        : `${updates.length} tool_call_update messages, ${late} of them with no diff part in their content`
    },
    {
      name: 'the edit really landed',
      ok: after.includes('third'),
      note: flat(after)
    },
    {
      name: 'the turn ended properly',
      ok: turn?.stopReason === 'end_turn',
      note: `stopReason ${turn?.stopReason ?? 'nothing'}`
    }
  ]

  console.log('')
  for (const check of checks) console.log(`${check.ok ? 'PASS' : 'FAIL'}  ${check.name}\n      ${check.note}`)

  const seen = [...kinds.entries()].map(([kind, count]) => `${kind} ${count}`).join(', ')
  console.log(`\nupdates:  ${seen || 'nothing arrived'}`)
  console.log(`answer:   ${flat(wrote.join('')).slice(0, 200)}`)

  const failed = checks.filter(c => !c.ok)
  if (failed.length) {
    console.error(`\n${failed.length} of ${checks.length} checks failed off the real CLI`)
    process.exitCode = 1
  } else {
    console.log('\nlive thinking, a streamed answer, a named tool, a real diff and an edit that landed, off the real CLI')
  }
} catch (error) {
  if (absent(error)) console.error(`this check needs the gemini CLI on PATH, and there is no ${binary()} here`)
  else if (unsigned(error)) console.error(`this check needs a signed in gemini, and this machine has none: ${flat(error.rpc?.message ?? '')}`)
  else console.error(`the run fell over: ${error.message}`)
  process.exitCode = 1
} finally {
  stop()
  await rm(dir, { recursive: true, force: true })
}
