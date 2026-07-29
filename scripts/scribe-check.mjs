import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

// The parts of a dictation no fake can stand in for. A unit suite can say the
// rules are right about chunks it made up itself; only this can say whisper
// really hands back chunks of that shape, and that real speech comes out the
// other end as a written sentence.
//
// The precedent is written down: every unit suite passed the whole time the
// voice listener was silently broken, because the only thing that could see it
// was a script handing the real model real speech.

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const SAID =
  'So um I think we should ship it today. Actually, wait. I think we should ship it tomorrow.'
const WANTED = ['ship', 'tomorrow']
const UNWANTED = [' um ', ' uh ']

async function speech(dir) {
  const file = path.join(dir, 'said.wav')
  await new Promise((resolve, reject) => {
    const child = spawn('say', ['-o', file, '--data-format=LEF32@16000', SAID], { stdio: 'ignore' })
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error('say could not make the speech'))))
    child.on('error', () => reject(new Error('this check needs the say command, which is macOS only')))
  })
  const wav = await readFile(file)
  let at = 12
  while (at < wav.length - 8) {
    const id = wav.toString('ascii', at, at + 4)
    const size = wav.readUInt32LE(at + 4)
    if (id === 'data') {
      const raw = wav.subarray(at + 8, at + 8 + size)
      return new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + Math.floor(raw.length / 4) * 4))
    }
    at += 8 + size + (size % 2)
  }
  throw new Error('the speech came out with nothing in it')
}

async function bundled(dir, from, name) {
  const file = path.join(dir, name)
  await build({
    entryPoints: [path.join(root, from)],
    bundle: true,
    format: 'esm',
    outfile: file,
    logLevel: 'error'
  })
  return import(file)
}

// The key is the other thing that fails without a word. A native module that
// will not load, or a keycode nothing answers to, is a hotkey that does nothing
// at all, and the app is written to carry on rather than fall over when it
// happens.
function keys() {
  try {
    const { UiohookKey } = createRequire(import.meta.url)('uiohook-napi')
    const wanted = ['AltRight', 'CtrlRight', 'Ctrl', 'Meta', 'V']
    const missing = wanted.filter(name => typeof UiohookKey[name] !== 'number')
    if (missing.length > 0) return `libuiohook has no keycode for ${missing.join(', ')}`
    return null
  } catch (error) {
    return `libuiohook would not load: ${error.message}`
  }
}

const dir = await mkdtemp(path.join(tmpdir(), 'crew-scribe-'))
let bad = false
try {
  const problem = keys()
  console.log(problem ? `keys:  ${problem}` : 'keys:  the hook loads and knows every key Scribe uses')
  if (problem) bad = true

  const [audio, { LISTEN_MODEL, askedOf }, { tidy, TIDY_RULES }] = await Promise.all([
    speech(dir),
    bundled(dir, 'src/renderer/src/media/voice/models.ts', 'models.mjs'),
    bundled(dir, 'src/shared/scribeTidy.ts', 'tidy.mjs')
  ])
  const { env, pipeline } = await import('@huggingface/transformers')
  env.allowLocalModels = false
  const listen = await pipeline('automatic-speech-recognition', LISTEN_MODEL, {
    dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' }
  })
  const result = await listen(audio, { ...askedOf(LISTEN_MODEL), return_timestamps: true })
  const chunks = (result.chunks ?? []).map(one => ({
    text: (one.text ?? '').trim(),
    start: one.timestamp?.[0] ?? 0,
    end: one.timestamp?.[1] ?? 0
  }))
  if (chunks.length === 0) throw new Error('whisper handed back no timestamps at all')
  const spread = chunks[chunks.length - 1].end - chunks[0].start
  if (!(spread > 1)) throw new Error('every chunk came back at the same moment, so there are no gaps to read')

  const written = tidy(chunks, TIDY_RULES)
  console.log(`said:    ${SAID}`)
  console.log(`chunks:  ${chunks.length}, over ${spread.toFixed(1)}s`)
  console.log(`written: ${written}`)

  const low = ` ${written.toLowerCase()} `
  const missed = WANTED.filter(word => !low.includes(word))
  const left = UNWANTED.filter(word => low.includes(word))
  if (missed.length > 0) {
    console.error(`nothing was written for ${missed.join(', ')}`)
    bad = true
  }
  if (left.length > 0) {
    console.error(`the tidying left ${left.map(word => word.trim()).join(', ')} in`)
    bad = true
  }
  if (!/[.!?]$/.test(written)) {
    console.error('what was written does not end on a mark')
    bad = true
  }
  if (!bad) console.log('real speech, the real model, a written sentence out the other end')
} catch (error) {
  console.error(`scribe fell over: ${error.message}`)
  bad = true
} finally {
  await rm(dir, { recursive: true, force: true })
}

// The paste itself is not checked here and cannot be: it needs a desktop with
// somewhere to type, and on macOS an Accessibility permission a script cannot
// grant itself.
//
// Killed rather than exited. The runtime whisper runs on leaves threads behind
// that abort while node is tearing itself down, and an abort is a signal, which
// is a check that says it failed after saying every word of it passed.
console.log(bad ? 'scribe-check: failed' : 'scribe-check: passed')
process.kill(process.pid, bad ? 'SIGKILL' : 'SIGTERM')
