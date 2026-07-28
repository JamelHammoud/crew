import { readFileSync } from 'node:fs'
import { env, pipeline } from '@huggingface/transformers'

env.allowLocalModels = false

const buf = readFileSync('/tmp/crewvoice.wav')
let at = 12, data = null
while (at < buf.length - 8) {
  const id = buf.toString('ascii', at, at + 4)
  const size = buf.readUInt32LE(at + 4)
  if (id === 'data') { data = buf.subarray(at + 8, at + 8 + size); break }
  at += 8 + size + (size % 2)
}
const audio = new Float32Array(data.buffer.slice(data.byteOffset, data.byteOffset + Math.floor(data.length / 4) * 4))

const listen = await pipeline('automatic-speech-recognition', 'onnx-community/whisper-base.en', {
  dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' }
})
console.log('model loaded')

try {
  const asApp = await listen(audio, { language: 'en', task: 'transcribe' })
  console.log('AS THE APP ASKS:', JSON.stringify(asApp))
} catch (error) {
  console.log('AS THE APP ASKS threw:', error.message)
}

const plain = await listen(audio)
console.log('ASKED PLAINLY:', JSON.stringify(plain))
