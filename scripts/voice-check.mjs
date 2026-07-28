import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

// The one part of a conversation no fake can stand in for: the real model, told
// what the app tells it, handed real speech. A listener that throws on every
// utterance and a listener that hears nothing look exactly the same from the
// outside, which is a microphone that appears to do nothing, and every unit
// test passed the whole time this was broken.

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const SAID = 'Hey there. Can you hear me now? Tell me what is in this project.'
const WORDS = ['hear', 'me', 'project']

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

const dir = await mkdtemp(path.join(tmpdir(), 'crew-voice-'))
try {
  const [audio, { LISTEN_MODEL, askedOf }] = await Promise.all([speech(dir), settings(dir)])
  const { env, pipeline } = await import('@huggingface/transformers')
  env.allowLocalModels = false
  const listen = await pipeline('automatic-speech-recognition', LISTEN_MODEL, {
    dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' }
  })
  const result = await listen(audio, askedOf(LISTEN_MODEL))
  const heard = (Array.isArray(result) ? result.map(part => part.text).join(' ') : result.text) ?? ''
  console.log(`said:  ${SAID}`)
  console.log(`heard: ${heard.trim()}`)
  const missed = WORDS.filter(word => !heard.toLowerCase().includes(word))
  if (missed.length > 0) {
    console.error(`the listener made nothing of ${missed.join(', ')}`)
    process.exit(1)
  }
  console.log('real speech, the real model, words back out')
} catch (error) {
  console.error(`the listener fell over: ${error.message}`)
  process.exit(1)
} finally {
  await rm(dir, { recursive: true, force: true })
}
