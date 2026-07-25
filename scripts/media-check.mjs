import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import electron from 'electron'

// The one part of a huddle no fake can stand in for: two real browser
// connections, agreeing on three slots, with pictures and sound coming out of
// the ones this side is listening to. A call can reach connected, carry every
// packet, and still be silent if the slots do not line up, so this runs the
// same code the app runs and looks at what actually arrives.

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const PAGE = `<!doctype html><html><body><script src="peer.js"></script><script>
const { ipcRenderer } = require('electron')
let link = null

function loop() {
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 180
  const paint = canvas.getContext('2d')
  let step = 0
  setInterval(() => {
    paint.fillStyle = ['#f00', '#0f0', '#00f'][step++ % 3]
    paint.fillRect(0, 0, canvas.width, canvas.height)
  }, 66)
  return canvas.captureStream(15).getVideoTracks()[0]
}

function tone() {
  const audio = new AudioContext()
  const source = audio.createOscillator()
  const out = audio.createMediaStreamDestination()
  source.connect(out)
  source.start()
  return out.stream.getAudioTracks()[0]
}

window.start = (other, polite) => {
  link = new CrewPeer.PeerLink({
    peerId: other,
    polite,
    send: signal => ipcRenderer.send('signal', { to: other, signal }),
    onChange: () => {}
  })
  link.publish({ mic: tone(), camera: loop(), screen: null })
  ipcRenderer.on('signal', (_event, message) => link.accept(message.signal))
  return true
}

window.report = async () => {
  try {
    const pc = link.pc
    const audio = []
    const video = []
    ;(await pc.getStats()).forEach(entry => {
      if (entry.type !== 'inbound-rtp') return
      if (entry.kind === 'audio') audio.push(entry.packetsReceived || 0)
      if (entry.kind === 'video') video.push(entry.bytesReceived || 0)
    })
    return {
      state: link.state,
      slots: pc.getTransceivers().length,
      hearing: (link.remote.mic.getAudioTracks()[0] || {}).muted === false,
      seeing: (link.remote.camera.getVideoTracks()[0] || {}).muted === false,
      packets: Math.max(0, ...audio),
      bytes: Math.max(0, ...video)
    }
  } catch (error) {
    return { failed: String(error && error.message) }
  }
}
</script></body></html>`

const MAIN = `import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'

const delay = Number(process.env.SIGNAL_DELAY_MS || 0)
const windows = {}

const report = async (id) => windows[id].webContents.executeJavaScript('window.report()')

app.whenReady().then(async () => {
  for (const id of ['a', 'b']) {
    const window = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: true, contextIsolation: false }
    })
    await window.loadFile(path.join(import.meta.dirname, 'peer.html'))
    windows[id] = window
  }
  ipcMain.on('signal', (_event, message) => {
    const target = windows[message.to]
    if (target) setTimeout(() => target.webContents.send('signal', message), delay)
  })
  await Promise.all([
    windows.a.webContents.executeJavaScript("window.start('b', true)"),
    windows.b.webContents.executeJavaScript("window.start('a', false)")
  ])
  await new Promise(resolve => setTimeout(resolve, 10000))
  const seen = { a: await report('a'), b: await report('b') }
  console.log('CHECK ' + JSON.stringify(seen))
  app.exit(0)
}).catch(error => {
  console.log('CHECK ' + JSON.stringify({ failed: String(error && error.message) }))
  app.exit(1)
})
`

async function stage() {
  const dir = await mkdtemp(path.join(tmpdir(), 'crew-media-'))
  await build({
    entryPoints: [path.join(root, 'src/renderer/src/media/peer.ts')],
    bundle: true,
    format: 'iife',
    globalName: 'CrewPeer',
    outfile: path.join(dir, 'peer.js'),
    logLevel: 'error'
  })
  await writeFile(path.join(dir, 'peer.html'), PAGE)
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
    child.stdout.on('data', chunk => (out += chunk))
    child.stderr.on('data', () => {})
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('the check never finished'))
    }, 90_000)
    child.on('exit', () => {
      clearTimeout(timer)
      const line = out.split('\n').find(text => text.startsWith('CHECK '))
      if (!line) return reject(new Error('the check said nothing'))
      resolve(JSON.parse(line.slice(6)))
    })
  })
}

function judge(side, seen) {
  const problems = []
  if (seen.failed) return [`${side} fell over: ${seen.failed}`]
  if (seen.state !== 'connected') problems.push(`${side} never connected, it is ${seen.state}`)
  if (seen.slots !== 3) problems.push(`${side} has ${seen.slots} slots, there should be 3`)
  if (!seen.hearing) problems.push(`${side} is not hearing the other end`)
  if (!seen.seeing) problems.push(`${side} is not seeing the other end`)
  if (seen.packets < 50) problems.push(`${side} took ${seen.packets} voice packets`)
  if (seen.bytes < 10_000) problems.push(`${side} took ${seen.bytes} bytes of pictures`)
  return problems
}

const dir = await stage()
try {
  const seen = await run(dir)
  const problems = [...judge('a', seen.a ?? seen), ...judge('b', seen.b ?? seen)]
  for (const [side, side_seen] of Object.entries(seen)) {
    if (side_seen.failed) continue
    console.log(
      `${side}: ${side_seen.state}, ${side_seen.slots} slots, ${side_seen.packets} voice packets, ` +
        `${side_seen.bytes} bytes of pictures`
    )
  }
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem)
    process.exit(1)
  }
  console.log('two real connections, three slots each, sound and pictures both ways')
} finally {
  await rm(dir, { recursive: true, force: true })
}
