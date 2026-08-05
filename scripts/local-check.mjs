import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const TASK =
  'Read notes.txt. Then add a line saying "third" to the end of it, keeping the two lines that are already there. Then reply with a sentence or two saying what you did.'

const NOTES = 'first\nsecond\n'
const LIMIT = 300000

const ENTRY = [
  "export { localProvider } from './src/runner/providers/local'",
  "export { candidateUrls, cachedRuntimes, findRuntimes } from './src/runner/providers/local-serve'",
  "export { cachedModels, refreshModels, servedModels } from './src/runner/providers/local-models'"
].join('\n')

async function load(dir) {
  const file = path.join(dir, 'local.mjs')
  await build({
    stdin: { contents: ENTRY, resolveDir: root, sourcefile: 'local-check.ts', loader: 'ts' },
    bundle: true,
    format: 'esm',
    platform: 'node',
    packages: 'external',
    outfile: file,
    logLevel: 'error'
  })
  return import(file)
}

function flat(text) {
  return String(text).replace(/\s+/g, ' ').trim()
}

function secs(ms) {
  return (ms / 1000).toFixed(2)
}

async function check(app, work) {
  const started = Date.now()
  const at = () => ((Date.now() - started) / 1000).toFixed(2).padStart(6)

  let lane = ''
  const say = (label, chunk) => {
    if (lane !== label) {
      if (lane) process.stdout.write('\n')
      process.stdout.write(`${at()} ${label.padEnd(9)} `)
      lane = label
    }
    process.stdout.write(chunk)
  }
  const line = text => {
    if (lane) {
      process.stdout.write('\n')
      lane = ''
    }
    console.log(text)
  }

  const runtimes = await app.findRuntimes()
  for (const runtime of runtimes) line(`${at()} runtime   ${runtime.label} at ${runtime.url}, speaking ${runtime.kind}`)
  if (!runtimes.length) {
    line(`${at()} runtime   nothing answered at ${app.candidateUrls().join(', ')}`)
    line('')
    line('nothing on this computer is serving models, so there was no turn to run')
    line('start one and run this again: `ollama serve`, or LM Studio with its own server on')
    line('an address off that list is reached by naming it in OLLAMA_HOST')
    return
  }

  const kept = await app.refreshModels(runtimes)
  const lists = await Promise.all(runtimes.map(async runtime => ({ runtime, served: await app.servedModels(runtime) })))
  for (const { runtime, served } of lists) {
    line(
      `${at()} models    ${runtime.label} serves ${served.length ? served.map(one => one.name).join(', ') : 'nothing'}`
    )
  }
  const offered = [...new Set(lists.flatMap(one => one.served.map(model => model.name)))]
  const dropped = offered.filter(name => !kept.includes(name))
  if (dropped.length) line(`${at()} models    the tools filter left out ${dropped.join(', ')}`)

  if (!kept.length) {
    line('')
    line('a server answered and there is no model here that takes tools, so there was no turn to run')
    line('pull one and run this again: `ollama pull qwen3`, or any model that reads tool calls')
    return
  }

  const found = await app.localProvider.detect()
  const note = await app.localProvider.note()
  line(
    `${at()} detect    ${found ? 'the provider found this machine' : 'the provider found nothing'}${note ? `, saying "${note}"` : ''}`
  )

  const wantedUrl = process.env.CREW_LOCAL_URL?.trim()
  const runtime = runtimes.find(one => one.url === wantedUrl) ?? runtimes[0]
  const wantedModel = process.env.CREW_LOCAL_MODEL?.trim()
  const model = wantedModel && kept.includes(wantedModel) ? wantedModel : kept[0]
  if (wantedModel && model !== wantedModel) {
    line(`${at()} model     ${wantedModel} is not served here, so ${model} is what runs`)
  }
  line(`${at()} running   ${model} on ${runtime.label} at ${runtime.url}`)

  const steps = []
  let firstThought = 0
  let firstWord = 0
  let firstTool = 0
  let chars = 0
  let tokens = 0
  let cost = null

  const running = app.localProvider.start(
    TASK,
    work,
    {
      onStep: step => {
        steps.push(step)
        if (step.text) chars += step.text.length
        if (step.kind === 'thinking' && step.text) {
          if (!firstThought) firstThought = Date.now() - started
          say('thinking', step.text)
        } else if (step.kind === 'text' && step.text) {
          if (!firstWord) firstWord = Date.now() - started
          say('answer', step.text)
        } else if (step.name) {
          if (!firstTool) firstTool = Date.now() - started
          const files = step.files?.map(file => `${file.path} +${file.added}/-${file.removed}`).join(', ')
          line(
            `${at()} ${step.status.padEnd(7)} ${step.name.padEnd(9)} ${flat(step.detail ?? '').slice(0, 70)}${files ? ` [${files}]` : ''}`
          )
        }
      },
      onTokens: (counted, priced) => {
        tokens = counted
        cost = priced
      }
    },
    { address: runtime.url, model }
  )

  let late = false
  const killer = setTimeout(() => {
    late = true
    running.kill()
  }, LIMIT)

  let result
  try {
    result = await running.done
  } catch (error) {
    line('')
    if (late) console.error(`nothing came back within ${LIMIT / 1000}s, so the run was stopped`)
    else console.error(`the turn fell over: ${error.message}`)
    process.exitCode = 1
    return
  } finally {
    clearTimeout(killer)
  }

  const ended = Date.now() - started
  line(`${at()} answered  ${flat(result.text).slice(0, 200)}`)

  const after = await readFile(path.join(work, 'notes.txt'), 'utf8')
  const thoughts = steps.filter(step => step.kind === 'thinking' && step.text)
  const words = steps.filter(step => step.kind === 'text' && step.text)
  const tools = steps.filter(step => step.name)
  const opened = tools.filter(step => step.status === 'running')
  const named = [...new Set(tools.map(step => step.name))]
  const argued = opened.filter(step => step.detail || step.files?.length)
  const silent = opened.filter(step => !step.detail && !step.files?.length).map(step => step.name)
  const changed = tools.flatMap(step => step.files ?? [])
  const floor = Math.ceil(chars / 4)

  const checks = [
    {
      name: 'a runtime was found and the provider agrees it is there',
      ok: runtimes.length > 0 && found,
      note: `${runtimes.map(one => `${one.label} at ${one.url} speaking ${one.kind}`).join(', ')}, detect said ${found}, cached ${app.cachedRuntimes().length}`
    },
    {
      name: 'the model list came back with real names in it',
      ok: kept.length > 0 && app.cachedModels().length > 0,
      note: `${kept.length} of ${offered.length} kept: ${kept.join(', ')}${dropped.length ? `; the tools filter left out ${dropped.join(', ')}` : '; the tools filter left nothing out'}`
    },
    {
      name: 'thinking arrived while the work was going, or this model plainly has none',
      ok:
        thoughts.length === 0 ||
        (firstThought > 0 && firstThought < ended && (firstTool === 0 || firstThought < firstTool)),
      note: thoughts.length
        ? `${thoughts.length} chunks, ${thoughts.reduce((all, one) => all + one.text.length, 0)} characters, first at ${secs(firstThought)}s with the first tool at ${firstTool ? `${secs(firstTool)}s` : 'never'} and the run ending at ${secs(ended)}s`
        : 'no reasoning at all, which is the model rather than the transport'
    },
    {
      name: 'the answer streamed rather than landing whole',
      ok: words.length > 1 && firstWord > 0 && firstWord < ended,
      note: words.length
        ? `${words.length} chunks, ${words.reduce((all, one) => all + one.text.length, 0)} characters, first at ${secs(firstWord)}s of a run that ended at ${secs(ended)}s`
        : 'no answer text came through at all'
    },
    {
      name: 'a tool was named with real arguments in it',
      ok: opened.length > 0 && silent.length === 0,
      note: opened.length
        ? `${named.join(', ')}; ${argued.map(step => `${step.name} ${flat(step.detail ?? '').slice(0, 40)}`).join(' | ')}${silent.length ? `; ${silent.join(', ')} carried nothing` : ''}`
        : 'no tool was called at all'
    },
    {
      name: 'the change carried the file and its counted lines',
      ok: changed.some(file => file.added > 0 && file.diff),
      note: changed.length
        ? changed
            .map(file => `${file.path} +${file.added}/-${file.removed}${file.diff ? ' with a diff' : ' with no diff'}`)
            .join(', ')
        : 'no step carried a file change'
    },
    {
      name: 'the edit really landed on the disk',
      ok: after.includes('third') && after.includes('first') && after.includes('second'),
      note: flat(after)
    },
    {
      name: 'the tokens came through with numbers in them',
      ok: tokens > 0,
      note: `${tokens} tokens, price ${cost === null ? 'not worked out, since there is no rate for a local model' : cost}; the words alone would have put ${floor} under it, so the count ${tokens > floor ? "is the server's own" : "may be that floor rather than the server's own"}`
    }
  ]

  console.log('')
  for (const one of checks) console.log(`${one.ok ? 'PASS' : 'FAIL'}  ${one.name}\n      ${one.note}`)

  console.log(`\nruntime:  ${runtime.label} at ${runtime.url}`)
  console.log(`model:    ${model}`)
  console.log(`steps:    ${steps.length}, off ${opened.length} tool calls`)
  console.log(`answer:   ${flat(result.text).slice(0, 200)}`)

  const failed = checks.filter(one => !one.ok)
  if (failed.length) {
    console.error(`\n${failed.length} of ${checks.length} checks failed off the real model server`)
    process.exitCode = 1
  } else {
    console.log(
      '\na runtime, a model list, live thinking, a streamed answer, a named tool with its arguments, a real edit and counted tokens, off the real model server'
    )
  }
}

const dir = await mkdtemp(path.join(tmpdir(), 'crew-local-'))
const work = path.join(dir, 'work')
try {
  await mkdir(work, { recursive: true })
  await writeFile(path.join(work, 'notes.txt'), NOTES)
  await check(await load(dir), work)
} catch (error) {
  console.error(`the run fell over: ${error.message}`)
  process.exitCode = 1
} finally {
  await rm(dir, { recursive: true, force: true })
}
