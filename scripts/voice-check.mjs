import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import electron from 'electron'

// The half of a conversation no fake can stand in for: a real microphone track
// through a real worklet, cut into utterances by the gate the app ships. A gate
// that never opens and a gate that opens on everything both look exactly like a
// microphone doing nothing, and neither one says a word about itself.

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const SAID = 'Hey there. Can you hear me now? Tell me what is in this project.'

const PAGE = `<!doctype html><html><body><script src="ear.js"></script><script>
window.listen = async (seconds) => {
  const said = []
  let openedAt = 0
  const ear = new CrewEar.VoiceEar({
    onStart: () => { openedAt = performance.now() },
    onEnd: audio => {
      let peak = 0
      for (const sample of audio || []) peak = Math.max(peak, Math.abs(sample))
      said.push({
        seconds: audio ? Number((audio.length / 16000).toFixed(2)) : 0,
        held: Math.round(performance.now() - openedAt),
        peak: Number(peak.toFixed(4)),
        dropped: !audio
      })
    }
  })
  const problem = await ear.open()
  if (problem) return { failed: 'the microphone never opened: ' + problem }
  await new Promise(resolve => setTimeout(resolve, seconds * 1000))
  const floor = ear.noiseFloor
  ear.close()
  return { said, floor: Number(floor.toFixed(5)) }
}
</script></body></html>`

const MAIN = `import { app, BrowserWindow } from 'electron'
import path from 'node:path'

app.commandLine.appendSwitch('use-fake-device-for-media-stream')
app.commandLine.appendSwitch('use-fake-ui-for-media-stream')
app.commandLine.appendSwitch('use-file-for-fake-audio-capture', process.env.CREW_WAV)

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  })
  window.webContents.session.setPermissionRequestHandler((_web, _kind, allow) => allow(true))
  await window.loadFile(path.join(import.meta.dirname, 'ear.html'))
  const seen = await window.webContents.executeJavaScript('window.listen(' + (process.env.CREW_SECONDS || 12) + ')')
  console.log('CHECK ' + JSON.stringify(seen))
  app.exit(0)
}).catch(error => {
  console.log('CHECK ' + JSON.stringify({ failed: String(error && error.message) }))
  app.exit(1)
})
`

async function speech(dir) {
  const file = path.join(dir, 'said.wav')
  await new Promise((resolve, reject) => {
    const child = spawn('say', ['-o', file, '--data-format=LEI16@16000', SAID], { stdio: 'ignore' })
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error('say could not make the speech'))))
    child.on('error', reject)
  })
  return file
}

async function stage() {
  const dir = await mkdtemp(path.join(tmpdir(), 'crew-voice-'))
  await build({
    entryPoints: [path.join(root, 'src/renderer/src/media/voice/ear.ts')],
    bundle: true,
    format: 'iife',
    globalName: 'CrewEar',
    outfile: path.join(dir, 'ear.js'),
    logLevel: 'error'
  })
  await writeFile(path.join(dir, 'ear.html'), PAGE)
  await writeFile(path.join(dir, 'main.mjs'), MAIN)
  return dir
}

function run(dir, wav, seconds) {
  return new Promise((resolve, reject) => {
    const child = spawn(electron, [path.join(dir, 'main.mjs')], {
      env: { ...process.env, ELECTRON_ENABLE_LOGGING: '0', CREW_WAV: wav, CREW_SECONDS: String(seconds) },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let out = ''
    child.stdout.on('data', chunk => (out += chunk))
    child.stderr.on('data', () => {})
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('the check never finished'))
    }, (seconds + 40) * 1000)
    child.on('exit', () => {
      clearTimeout(timer)
      const line = out.split('\n').find(text => text.startsWith('CHECK '))
      if (!line) return reject(new Error('the check said nothing'))
      resolve(JSON.parse(line.slice(6)))
    })
  })
}

const seconds = Number(process.argv[2] || 12)
const dir = await stage()
try {
  const wav = await speech(dir)
  const seen = await run(dir, wav, seconds)
  if (seen.failed) {
    console.error(seen.failed)
    process.exit(1)
  }
  const kept = seen.said.filter(one => !one.dropped)
  for (const one of seen.said) {
    console.log(
      one.dropped
        ? `dropped after ${one.held}ms`
        : `heard ${one.seconds}s, peak ${one.peak}, gate held ${one.held}ms`
    )
  }
  console.log(`the room sat at ${seen.floor}`)
  if (kept.length === 0) {
    console.error('the gate never handed over anything somebody said')
    process.exit(1)
  }
  console.log(`${kept.length} utterance${kept.length === 1 ? '' : 's'} out of a real microphone`)
} finally {
  await rm(dir, { recursive: true, force: true })
}
