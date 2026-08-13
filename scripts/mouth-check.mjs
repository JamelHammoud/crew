import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'
import { build } from 'esbuild'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const VERDICT = 'mouth-check:'
const LIMIT = 900_000

const PAGE = `import { KokoroTTS, TextSplitterStream } from 'kokoro-js'
import { DEFAULT_VOICE, SPEAK_MODEL, SPEAK_RATE, SPEAK_VOICES } from '${path.join(root, 'src/renderer/src/media/voice/models.ts')}'

const SAID = [
  'Yeah, I had a look. ',
  'The tests live in the tests folder and they boot real servers on loopback. ',
  'Do you want me to run the whole suite?'
]

const ONE_LINE = 'Yeah, that one is done.'

const say = text => console.log('SAY ' + text)

const heard = samples => {
  let peak = 0
  let sum = 0
  for (const one of samples) {
    const size = Math.abs(one)
    if (size > peak) peak = size
    sum += one * one
  }
  return { peak, rms: samples.length ? Math.sqrt(sum / samples.length) : 0 }
}

const open = watch =>
  KokoroTTS.from_pretrained(SPEAK_MODEL, {
    dtype: 'q8',
    device: 'wasm',
    progress_callback: report => {
      if (report.status !== 'progress' || !report.total) return
      watch.set(report.file || '', report.total)
    }
  })

async function turn(tts, voice, sentences) {
  const stream = new TextSplitterStream()
  const opened = performance.now()
  const chunks = []
  const running = (async () => {
    for await (const piece of tts.stream(stream, { voice })) {
      const samples = piece.audio.audio
      chunks.push({
        text: piece.text,
        rate: piece.audio.sampling_rate,
        samples: samples.length,
        at: Math.round(performance.now() - opened),
        ...heard(samples)
      })
    }
  })()
  for (const sentence of sentences) stream.push(sentence)
  stream.close()
  await running
  return chunks
}

window.check = async () => {
  const watch = new Map()
  let tts = null
  let cold = 0
  try {
    const started = performance.now()
    tts = await open(watch)
    cold = Math.round(performance.now() - started)
  } catch (error) {
    return { dead: String(error && error.message) }
  }
  const bytes = [...watch.values()].reduce((all, one) => all + one, 0)
  say('the model loaded in ' + (cold / 1000).toFixed(2) + 's, now saying three sentences')

  const warmStarted = performance.now()
  await open(new Map())
  const warm = Math.round(performance.now() - warmStarted)

  const chunks = await turn(tts, DEFAULT_VOICE, SAID)
  say('the turn came back in ' + chunks.length + ' chunks, now trying every voice')

  const voices = []
  for (const voice of SPEAK_VOICES) {
    const said = await turn(tts, voice.id, [ONE_LINE])
    voices.push({
      id: voice.id,
      name: voice.name,
      accent: voice.accent,
      samples: said.reduce((all, one) => all + one.samples, 0),
      rate: said.length ? said[0].rate : 0,
      peak: said.length ? Math.max(...said.map(one => one.peak)) : 0,
      rms: said.length ? Math.max(...said.map(one => one.rms)) : 0
    })
    say('said it in ' + voice.id)
  }

  return { cold, warm, bytes, files: watch.size, chunks, voices, rate: SPEAK_RATE, model: SPEAK_MODEL }
}
`

const HOST = `<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>mouth</title></head>
  <body><script type="module" src="/page.js"></script></body>
</html>
`

const MAIN = `import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { app, BrowserWindow } from 'electron'

const dir = import.meta.dirname
const TYPES = { '.html': 'text/html', '.js': 'text/javascript' }

const server = createServer(async (request, response) => {
  const name = request.url === '/' ? '/host.html' : request.url.split('?')[0]
  try {
    const body = await readFile(path.join(dir, path.basename(name)))
    response.writeHead(200, { 'content-type': TYPES[path.extname(name)] || 'application/octet-stream' })
    response.end(body)
  } catch {
    response.writeHead(404)
    response.end()
  }
})

const port = await new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)))

app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer')

app
  .whenReady()
  .then(async () => {
    const window = new BrowserWindow({ show: false, webPreferences: { backgroundThrottling: false } })
    window.webContents.on('console-message', (_event, _level, message) => {
      if (String(message).startsWith('SAY ')) console.log('SAY ' + String(message).slice(4))
    })
    await window.loadURL('http://127.0.0.1:' + port + '/')
    const seen = await window.webContents.executeJavaScript('window.check()')
    console.log('CHECK ' + JSON.stringify(seen))
    app.exit(0)
  })
  .catch(error => {
    console.log('CHECK ' + JSON.stringify({ dead: String(error && error.message) }))
    app.exit(0)
  })
`

async function stage() {
  const dir = await mkdtemp(path.join(tmpdir(), 'crew-mouth-'))
  await build({
    stdin: { contents: PAGE, resolveDir: root, sourcefile: 'mouth-check.js', loader: 'js' },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    outfile: path.join(dir, 'page.js'),
    logLevel: 'error'
  })
  await writeFile(path.join(dir, 'host.html'), HOST)
  await writeFile(path.join(dir, 'main.mjs'), MAIN)
  return dir
}

function run(dir) {
  return new Promise((resolve, reject) => {
    const child = spawn(electron, [path.join(dir, 'main.mjs')], {
      env: { ...process.env, ELECTRON_ENABLE_LOGGING: '0' },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let out = ''
    child.stdout.on('data', chunk => {
      out += chunk
      for (const line of String(chunk).split('\n')) {
        if (line.startsWith('SAY ')) console.log(`         ${line.slice(4)}`)
      }
    })
    child.stderr.on('data', () => {})
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`nothing came back within ${LIMIT / 1000}s`))
    }, LIMIT)
    child.on('exit', () => {
      clearTimeout(timer)
      const line = out.split('\n').find(text => text.startsWith('CHECK '))
      if (!line) return reject(new Error('the window said nothing'))
      resolve(JSON.parse(line.slice(6)))
    })
  })
}

const QUIET_PEAK = 0.01
const QUIET_RMS = 0.001

const loud = one => one.peak >= QUIET_PEAK && one.rms >= QUIET_RMS
const secs = ms => `${(ms / 1000).toFixed(2)}s`

function report(seen) {
  console.log(`model:   ${seen.model}, q8 on wasm, the way the worker loads it`)
  console.log(`cold:    ${secs(seen.cold)}, ${(seen.bytes / 1_000_000).toFixed(1)}MB over ${seen.files} files`)
  console.log(`warm:    ${secs(seen.warm)}, loaded again with those files already here`)

  console.log('\nthe turn, handed over a sentence at a time the way the app hands it over:')
  for (const chunk of seen.chunks) {
    const seconds = chunk.rate ? chunk.samples / chunk.rate : 0
    console.log(
      `  ${secs(chunk.at).padStart(7)}  ${seconds.toFixed(2)}s at ${chunk.rate}Hz  peak ${chunk.peak.toFixed(4)}  rms ${chunk.rms.toFixed(4)}  ${loud(chunk) ? 'sound' : 'SILENT'}  ${chunk.text.trim().slice(0, 40)}`
    )
  }

  console.log('\nevery voice the picker offers, on one sentence each:')
  for (const one of seen.voices) {
    console.log(
      `  ${one.id.padEnd(11)} ${one.name.padEnd(8)} ${one.accent.padEnd(9)} ${String(one.samples).padStart(7)} samples at ${one.rate}Hz  peak ${one.peak.toFixed(4)}  rms ${one.rms.toFixed(4)}  ${loud(one) ? 'sound' : 'SILENT'}`
    )
  }

  const chunks = seen.chunks
  const last = chunks[chunks.length - 1]
  const rates = [...new Set([...chunks, ...seen.voices].map(one => one.rate))]
  const quiet = chunks.filter(one => !loud(one))
  const mute = seen.voices.filter(one => !loud(one))
  return [
    {
      name: 'audio came back a sentence at a time rather than a reply at a time',
      ok: chunks.length > 1,
      note: chunks.length
        ? `${chunks.length} chunks, landing at ${chunks.map(one => secs(one.at)).join(', ')}`
        : 'the model handed back nothing at all'
    },
    {
      name: 'the first sentence was ready well before the last one',
      ok: chunks.length > 1 && last.at - chunks[0].at > chunks[0].at * 0.2,
      note: chunks.length
        ? `first at ${secs(chunks[0].at)} of a turn that finished at ${secs(last.at)}, and the app speaks each one as it lands`
        : 'nothing landed'
    },
    {
      name: 'the samples are real sound rather than a buffer of zeroes',
      ok: chunks.length > 0 && quiet.length === 0,
      note: chunks.length
        ? `peak ${Math.max(...chunks.map(one => one.peak)).toFixed(4)}, rms ${Math.max(...chunks.map(one => one.rms)).toFixed(4)}${quiet.length ? `, and ${quiet.length} of them came back under peak ${QUIET_PEAK}` : ''}`
        : 'there were no samples to read'
    },
    {
      name: 'the rate it really came back at is the rate the app builds its buffer on',
      ok: rates.length === 1 && rates[0] === seen.rate,
      note: `the model says ${rates.join(', ') || 'nothing'} and SPEAK_RATE is ${seen.rate}`
    },
    {
      name: 'every voice the picker offers really produced sound',
      ok: seen.voices.length > 0 && mute.length === 0,
      note: mute.length ? `${mute.map(one => one.id).join(', ')} came back silent` : seen.voices.map(one => one.id).join(', ')
    }
  ]
}

const dir = await stage()
let bad = false
try {
  const seen = await run(dir)
  if (seen.dead) {
    console.log(`load:    the voice model would not load in a real window: ${seen.dead}`)
    console.log('there is nothing to say without it, so nothing was checked')
  } else {
    const checks = report(seen)
    console.log('')
    for (const one of checks) console.log(`${one.ok ? 'PASS' : 'FAIL'}  ${one.name}\n      ${one.note}`)
    const failed = checks.filter(one => !one.ok)
    bad = failed.length > 0
    console.log('')
    console.log(
      bad
        ? `${failed.length} of ${checks.length} checks failed off the real model`
        : 'the real model, real sentences, real sound out the other end'
    )
  }
} catch (error) {
  console.log(`the mouth fell over: ${error.message}`)
  bad = true
} finally {
  await rm(dir, { recursive: true, force: true })
}

console.log(`${VERDICT} ${bad ? 'failed' : 'passed'}`)
process.exit(0)
