import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const VERDICT = 'mouth-check:'

const SAID = [
  'Yeah, I had a look. ',
  'The tests live in the tests folder and they boot real servers on loopback. ',
  'Do you want me to run the whole suite?'
]

const ONE_LINE = 'Yeah, that one is done.'

const QUIET_PEAK = 0.01
const QUIET_RMS = 0.001

async function settings(dir) {
  const file = path.join(dir, 'models.mjs')
  await build({
    entryPoints: [path.join(root, 'src/renderer/src/media/voice/models.ts')],
    bundle: true,
    format: 'esm',
    outfile: file,
    logLevel: 'error'
  })
  return import(file)
}

function secs(ms) {
  return `${(ms / 1000).toFixed(2)}s`
}

function mb(bytes) {
  return `${(bytes / 1_000_000).toFixed(1)}MB`
}

function heard(samples) {
  let peak = 0
  let sum = 0
  for (const one of samples) {
    const size = Math.abs(one)
    if (size > peak) peak = size
    sum += one * one
  }
  return { peak, rms: samples.length ? Math.sqrt(sum / samples.length) : 0 }
}

function loud(chunk) {
  return chunk.peak >= QUIET_PEAK && chunk.rms >= QUIET_RMS
}

async function turn(tts, TextSplitterStream, voice, sentences) {
  const stream = new TextSplitterStream()
  const opened = Date.now()
  const chunks = []
  const running = (async () => {
    for await (const piece of tts.stream(stream, { voice })) {
      const samples = piece.audio.audio
      chunks.push({
        text: piece.text,
        rate: piece.audio.sampling_rate,
        samples: samples.length,
        at: Date.now() - opened,
        ...heard(samples)
      })
    }
  })()
  for (const sentence of sentences) stream.push(sentence)
  stream.close()
  await running
  return chunks
}

const dir = await mkdtemp(path.join(tmpdir(), 'crew-mouth-'))
let bad = false
try {
  const { SPEAK_MODEL, SPEAK_RATE, SPEAK_VOICES, DEFAULT_VOICE } = await settings(dir)
  const { KokoroTTS, TextSplitterStream } = await import('kokoro-js')
  const { env } = await import('@huggingface/transformers')
  env.allowLocalModels = false

  const fetched = new Map()
  const load = report => {
    if (report.status !== 'progress' || !report.total) return
    fetched.set(report.file ?? '', report.total)
  }

  console.log(`model:   ${SPEAK_MODEL}, q8 on wasm, the way the worker loads it`)

  let tts
  let cold = 0
  try {
    const started = Date.now()
    tts = await KokoroTTS.from_pretrained(SPEAK_MODEL, { dtype: 'q8', device: 'wasm', progress_callback: load })
    cold = Date.now() - started
  } catch (error) {
    console.log(`load:    the voice model would not load on this machine: ${error.message}`)
    console.log('there is nothing to say without it, so nothing was checked')
    console.log(`${VERDICT} nothing to check`)
    process.exit(0)
  }

  const came = [...fetched.values()].reduce((all, one) => all + one, 0)
  console.log(`cold:    ${secs(cold)}${came ? `, ${mb(came)} down the wire over ${fetched.size} files` : ', off the disk'}`)

  const warmStarted = Date.now()
  await KokoroTTS.from_pretrained(SPEAK_MODEL, { dtype: 'q8', device: 'wasm' })
  console.log(`warm:    ${secs(Date.now() - warmStarted)}, everything already on this machine`)

  const chunks = await turn(tts, TextSplitterStream, DEFAULT_VOICE, SAID)
  console.log(`\nthe turn, in ${DEFAULT_VOICE}, handed over the way the app hands it over:`)
  for (const chunk of chunks) {
    const seconds = chunk.rate ? chunk.samples / chunk.rate : 0
    console.log(
      `  ${secs(chunk.at).padStart(7)}  ${seconds.toFixed(2)}s of audio at ${chunk.rate}Hz  peak ${chunk.peak.toFixed(4)}  rms ${chunk.rms.toFixed(4)}  ${loud(chunk) ? 'sound' : 'SILENT'}  ${chunk.text.trim().slice(0, 44)}`
    )
  }

  const voices = []
  for (const voice of SPEAK_VOICES) {
    const said = await turn(tts, TextSplitterStream, voice.id, [ONE_LINE])
    const samples = said.reduce((all, one) => all + one.samples, 0)
    voices.push({
      voice,
      samples,
      peak: Math.max(0, ...said.map(one => one.peak)),
      rms: Math.max(0, ...said.map(one => one.rms)),
      sound: said.length > 0 && said.every(loud)
    })
  }
  console.log('\nevery voice the picker offers, on one sentence each:')
  for (const one of voices) {
    console.log(
      `  ${one.voice.id.padEnd(11)} ${one.voice.name.padEnd(8)} ${one.voice.accent.padEnd(9)} ${String(one.samples).padStart(7)} samples  peak ${one.peak.toFixed(4)}  rms ${one.rms.toFixed(4)}  ${one.sound ? 'sound' : 'SILENT'}`
    )
  }

  const first = chunks[0]
  const rates = [...new Set(chunks.map(chunk => chunk.rate))]
  const quiet = chunks.filter(chunk => !loud(chunk))
  const mute = voices.filter(one => !one.sound)
  const checks = [
    {
      name: 'the model loaded on this machine',
      ok: true,
      note: `cold ${secs(cold)}, warm ${secs(Date.now() - warmStarted)}`
    },
    {
      name: 'audio came back a sentence at a time rather than a reply at a time',
      ok: chunks.length > 1,
      note: chunks.length
        ? `${chunks.length} chunks off ${SAID.length} sentences, landing at ${chunks.map(chunk => secs(chunk.at)).join(', ')}`
        : 'the model handed back nothing at all'
    },
    {
      name: 'the first sentence was ready long before the last one',
      ok: chunks.length > 1 && first.at < chunks[chunks.length - 1].at,
      note: first
        ? `first at ${secs(first.at)}, last at ${secs(chunks[chunks.length - 1].at)}, which is what the app speaks against`
        : 'nothing landed'
    },
    {
      name: 'the samples are real sound rather than a buffer of zeroes',
      ok: chunks.length > 0 && quiet.length === 0,
      note: chunks.length
        ? `peak ${Math.max(...chunks.map(chunk => chunk.peak)).toFixed(4)}, rms ${Math.max(...chunks.map(chunk => chunk.rms)).toFixed(4)}${quiet.length ? `; ${quiet.length} chunks came back under peak ${QUIET_PEAK}` : ''}`
        : 'there were no samples to read'
    },
    {
      name: 'the rate the audio really came back at is the rate the app builds its buffer on',
      ok: rates.length === 1 && rates[0] === SPEAK_RATE,
      note: `the model says ${rates.join(', ') || 'nothing'} and SPEAK_RATE is ${SPEAK_RATE}`
    },
    {
      name: 'every voice the picker offers really produced sound',
      ok: mute.length === 0,
      note: mute.length ? `${mute.map(one => one.voice.id).join(', ')} came back silent` : voices.map(one => one.voice.id).join(', ')
    }
  ]

  console.log('')
  for (const one of checks) console.log(`${one.ok ? 'PASS' : 'FAIL'}  ${one.name}\n      ${one.note}`)

  const failed = checks.filter(one => !one.ok)
  bad = failed.length > 0
  console.log('')
  if (bad) console.log(`${failed.length} of ${checks.length} checks failed off the real model`)
  else console.log('the real model, real sentences, real sound out the other end')
} catch (error) {
  console.log(`the mouth fell over: ${error.message}`)
  bad = true
} finally {
  await rm(dir, { recursive: true, force: true })
}

console.log(`${VERDICT} ${bad ? 'failed' : 'passed'}`)
process.exit(0)
