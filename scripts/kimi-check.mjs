import { spawn } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'

const TASK =
  'Read math.js. Think carefully about whether add() is correct. Fix the bug with an edit. Then run the command `echo done` in the shell.'

const BROKEN = 'export function add(a, b) {\n  return a - b\n}\n'
const LIMIT = 240000
const BARE = ['Read', 'Edit', 'Bash']
const SESSIONS = ['.kimi-code', 'sessions']
const WIRE = ['agents', 'main', 'wire.jsonl']
const SCOPE = 'turn'
const POLL = 1000

function binary() {
  if (process.env.CREW_KIMI) return process.env.CREW_KIMI
  const home = path.join(homedir(), '.kimi-code/bin/kimi')
  if (existsSync(home)) return home
  return 'kimi'
}

function flat(text) {
  return String(text).replace(/\s+/g, ' ').trim()
}

function counted(value, trail, found) {
  if (!value || typeof value !== 'object') return found
  for (const [key, inner] of Object.entries(value)) {
    const where = trail ? `${trail}.${key}` : key
    if (/token|usage|cost/i.test(key)) found.push({ where, value: inner })
    counted(inner, where, found)
  }
  return found
}

function wireAt(sessionId) {
  const root = path.join(homedir(), ...SESSIONS)
  let dirs
  try {
    dirs = readdirSync(root)
  } catch {
    return null
  }
  for (const dir of dirs) {
    const at = path.join(root, dir, sessionId, ...WIRE)
    if (existsSync(at)) return at
  }
  return null
}

function records(at) {
  let text
  try {
    text = readFileSync(at, 'utf8')
  } catch {
    return []
  }
  const out = []
  for (const line of text.split('\n')) {
    if (!line.includes('usage.record')) continue
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      continue
    }
    if (msg?.type !== 'usage.record' || msg?.usageScope !== SCOPE) continue
    if (!msg.usage || typeof msg.usage !== 'object') continue
    out.push(msg)
  }
  return out
}

function summed(found) {
  const add = key => found.reduce((all, one) => all + (Number.isFinite(one.usage[key]) ? one.usage[key] : 0), 0)
  const model = [...found].reverse().find(one => typeof one.model === 'string' && one.model.trim())
  return {
    calls: found.length,
    model: model?.model ?? '',
    input: add('inputOther'),
    output: add('output'),
    cacheRead: add('inputCacheRead'),
    cacheWrite: add('inputCacheCreation')
  }
}

const dir = await mkdtemp(path.join(tmpdir(), 'crew-kimi-'))
const work = path.join(dir, 'work')
let child = null
let killer = null
let watcher = null

function stop() {
  if (killer) clearTimeout(killer)
  if (watcher) clearInterval(watcher)
  if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
}

try {
  await mkdir(work, { recursive: true })
  await writeFile(path.join(work, 'math.js'), BROKEN)

  const started = Date.now()
  const at = () => ((Date.now() - started) / 1000).toFixed(2).padStart(6)

  child = spawn(binary(), ['acp'], { cwd: work, stdio: ['pipe', 'pipe', 'pipe'] })

  const heard = []
  const order = []
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
      waiting.set(id, { resolve, reject })
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
      options.find(o => o.kind === 'allow_always') ?? options.find(o => o.kind === 'allow_once') ?? options[0]
    console.log(
      `${at()} permission ${flat(message.params?.toolCall?.title ?? '')} answered ${picked?.optionId ?? 'nothing'}`
    )
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: { outcome: { outcome: 'selected', optionId: picked?.optionId ?? 'approve_always' } }
    })
  }

  const update = params => {
    const step = params?.update ?? {}
    const kind = step.sessionUpdate ?? 'unknown'
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1)
    order.push(kind)
    if (kind === 'agent_thought_chunk') {
      const text = step.content?.text ?? ''
      thoughts.push(text)
      if (text.trim()) console.log(`${at()} thinking  ${flat(text).slice(0, 70)}`)
    } else if (kind === 'agent_message_chunk') {
      const text = step.content?.text ?? ''
      messages.push(text)
      if (text.trim()) console.log(`${at()} answer    ${flat(text).slice(0, 70)}`)
    } else if (kind === 'tool_call') {
      calls.set(step.toolCallId, { title: step.title ?? '', kind: step.kind ?? '', status: step.status ?? '' })
      console.log(`${at()} tool      ${step.title} (${step.kind}) ${step.status}`)
    } else if (kind === 'tool_call_update') {
      updates.push(step)
      const seat = calls.get(step.toolCallId)
      const marks = [step.rawInput ? 'args' : '', step.rawOutput ? 'output' : ''].filter(Boolean).join(' ')
      console.log(`${at()} update    ${seat?.title ?? step.toolCallId} ${step.status ?? ''} ${marks}`)
    } else {
      console.log(`${at()} ${kind}`)
    }
  }

  const landed = message => {
    heard.push(message)
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
    if (message.error) seat.reject(new Error(`${message.method ?? 'call'} refused: ${JSON.stringify(message.error)}`))
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
    const dead =
      gone ?? new Error(`the CLI stopped with code ${code}${stderr ? `: ${flat(stderr).slice(0, 200)}` : ''}`)
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

  let wire = null
  let mid = null
  watcher = setInterval(() => {
    if (!wire) {
      wire = wireAt(session.sessionId)
      if (wire) console.log(`${at()} wire      ${wire}`)
    }
    if (!wire || mid) return
    const found = records(wire)
    if (!found.length) return
    mid = { at: at().trim(), ...summed(found) }
    console.log(`${at()} usage     ${mid.calls} record(s) while the turn is still going`)
  }, POLL)

  const turn = await ask('session/prompt', {
    sessionId: session.sessionId,
    prompt: [{ type: 'text', text: TASK }]
  })
  const stopped = at().trim()
  clearInterval(watcher)
  watcher = null
  console.log(`${stopped.padStart(6)} stopped   ${turn?.stopReason}`)

  if (!wire) wire = wireAt(session.sessionId)
  const usage = wire ? summed(records(wire)) : null

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

  const after = await readFile(path.join(work, 'math.js'), 'utf8')
  const titles = [...calls.values()].map(c => c.title)
  const firstTool = order.indexOf('tool_call')
  const firstThought = order.indexOf('agent_thought_chunk')
  const said = thoughts.filter(t => t.trim())
  const wrote = messages.filter(t => t.trim())
  const withArgs = updates.filter(u => u.rawInput && typeof u.rawInput === 'object')
  const idsOf = name => [...calls.entries()].filter(([, c]) => c.title === name).map(([id]) => id)
  const editIds = new Set(idsOf('Edit'))
  const bashIds = new Set(idsOf('Bash'))
  const editArgs = withArgs.filter(u => editIds.has(u.toolCallId)).map(u => u.rawInput)
  const bashArgs = withArgs.filter(u => bashIds.has(u.toolCallId)).map(u => u.rawInput)
  const bashOut = updates.filter(u => bashIds.has(u.toolCallId) && u.rawOutput !== undefined && u.rawOutput !== null)
  const goodEdit = editArgs.find(
    a => a.old_string !== undefined && a.new_string !== undefined && (a.path ?? a.file_path) !== undefined
  )
  const tokens = counted(heard, '', [])
  const argued = new Set(withArgs.map(u => u.toolCallId))
  const silent = [...calls.entries()].filter(([id]) => !argued.has(id)).map(([id, c]) => `${c.title || id}`)

  const live = firstThought !== -1 && firstTool !== -1 && firstThought < firstTool
  const checks = [
    {
      name: 'thinking arrived while the work was going',
      ok: live && said.length > 0,
      note: `${said.length} chunks, ${said.join('').length} characters, first thought at position ${firstThought}, first tool at position ${firstTool}`
    },
    {
      name: 'the answer streamed',
      ok: wrote.length > 1,
      note: `${wrote.length} message chunks, ${wrote.join('').length} characters`
    },
    {
      name: 'a tool was named',
      ok: titles.some(t => BARE.includes(t.trim())),
      note: titles.length ? titles.join(', ') : 'no tool call arrived'
    },
    {
      name: 'arguments really arrived',
      ok: withArgs.length > 0 && Boolean(goodEdit),
      note: goodEdit
        ? `path ${goodEdit.path ?? goodEdit.file_path}, old_string ${JSON.stringify(flat(goodEdit.old_string))}, new_string ${JSON.stringify(flat(goodEdit.new_string))}`
        : `${withArgs.length} updates carried rawInput, edit keys seen: ${editArgs.map(a => Object.keys(a).join('/')).join(' | ') || 'none'}`
    },
    {
      name: 'every tool that ran had its arguments filled in',
      ok: calls.size > 0 && silent.length === 0,
      note: silent.length
        ? `${silent.length} of ${calls.size} never carried rawInput: ${silent.join(', ')}`
        : `all ${calls.size} tool calls carried rawInput`
    },
    {
      name: 'the edit really landed',
      ok: after.includes('return a + b'),
      note: flat(after)
    },
    {
      name: 'the shell command was named and its output came back',
      ok: bashArgs.some(a => typeof a.command === 'string' && a.command) && bashOut.length > 0,
      note: `${
        bashArgs
          .map(a => a.command)
          .filter(Boolean)
          .join(', ') || 'no command'
      } , output ${bashOut.length ? flat(JSON.stringify(bashOut[bashOut.length - 1].rawOutput)).slice(0, 120) : 'never came back'}`
    },
    {
      name: 'the turn ended properly',
      ok: turn?.stopReason === 'end_turn',
      note: `stopReason ${turn?.stopReason}`
    },
    {
      name: 'the stream itself carries no token count, which is why the wire log is read',
      ok: tokens.length === 0,
      note: tokens.length
        ? `a count did arrive over the wire: ${tokens
            .slice(0, 6)
            .map(t => `${t.where} ${flat(JSON.stringify(t.value)).slice(0, 80)}`)
            .join(' | ')}`
        : 'no token, usage or cost figure anywhere in the stream, as expected'
    },
    {
      name: 'the wire log was found for this session',
      ok: Boolean(wire),
      note: wire ? wire : `nothing under ${path.join(homedir(), ...SESSIONS)} held ${session.sessionId}`
    },
    {
      name: 'the wire log holds usage records for the turn',
      ok: Boolean(usage && usage.calls > 0),
      note:
        usage && usage.calls
          ? `${usage.calls} calls on ${usage.model || 'an unnamed model'}, input ${usage.input}, output ${usage.output}, cache read ${usage.cacheRead}, cache creation ${usage.cacheWrite}, total input ${usage.input + usage.cacheRead + usage.cacheWrite}`
          : 'no usage.record with scope turn was written'
    },
    {
      name: 'the records were written live rather than only at the end',
      ok: Boolean(mid && mid.calls > 0),
      note: mid
        ? `${mid.calls} record(s) already on disk at ${mid.at}s, with the turn ending at ${stopped}s`
        : `nothing was on disk before the turn ended at ${stopped}s`
    }
  ]

  console.log('')
  for (const check of checks) console.log(`${check.ok ? 'PASS' : 'FAIL'}  ${check.name}\n      ${check.note}`)

  const seen = [...kinds.entries()].map(([kind, count]) => `${kind} ${count}`).join(', ')
  console.log(`\nupdates:  ${seen}`)
  console.log(`answer:   ${flat(wrote.join('')).slice(0, 200)}`)

  const failed = checks.filter(c => !c.ok)
  if (failed.length) {
    console.error(`\n${failed.length} of ${checks.length} checks failed off the real CLI`)
    process.exitCode = 1
  } else {
    console.log(
      '\nlive thinking, a streamed answer, named tools with their arguments, a real edit and live token counts, off the real CLI'
    )
  }
} catch (error) {
  console.error(`the run fell over: ${error.message}`)
  process.exitCode = 1
} finally {
  stop()
  await rm(dir, { recursive: true, force: true })
}
