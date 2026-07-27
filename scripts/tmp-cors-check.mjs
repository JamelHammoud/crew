import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import electron from 'electron'
import WebSocket from 'ws'

// The real host, read by a renderer served on a port of its own, which is what a
// run from source is. A fake cannot answer this: only the browser decides
// whether the answer to a fetch is handed to the page.

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const wav = () => {
  const rate = 8000
  const frames = rate
  const out = Buffer.alloc(44 + frames * 2)
  out.write('RIFF', 0)
  out.writeUInt32LE(36 + frames * 2, 4)
  out.write('WAVEfmt ', 8)
  out.writeUInt32LE(16, 16)
  out.writeUInt16LE(1, 20)
  out.writeUInt16LE(1, 22)
  out.writeUInt32LE(rate, 24)
  out.writeUInt32LE(rate * 2, 28)
  out.writeUInt16LE(2, 32)
  out.writeUInt16LE(16, 34)
  out.write('data', 36)
  out.writeUInt32LE(frames * 2, 40)
  return out
}

const dir = await mkdtemp(path.join(tmpdir(), 'crew-cors-'))
const repo = path.join(dir, 'repo')

await build({
  entryPoints: [path.join(root, 'scripts/tmp-host-entry.mjs')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['ws', 'node-pty', 'electron'],
  outfile: path.join(dir, 'host.mjs')
})

const { startHost } = await import(path.join(dir, 'host.mjs'))
const host = await startHost(repo)

// Add a track the way a member does, over the socket.
const ws = new WebSocket(`ws://127.0.0.1:${host.port}/ws`)
const file = await new Promise((resolve) => {
  ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'hello', role: 'ui', name: 'ali', code: host.code }))
    ws.send(
      JSON.stringify({
        type: 'music.add',
        name: 'Long Drive',
        mime: 'audio/wav',
        seconds: 12,
        data: wav().toString('base64')
      })
    )
  })
  ws.on('message', (raw) => {
    const msg = JSON.parse(String(raw))
    if (msg.type === 'music.shelf' && msg.uploads.length) resolve(msg.uploads[0].file)
  })
})

const PAGE = `<!doctype html><html><body><script>
window.tryPlay = async (url) => {
  try {
    const res = await fetch(url)
    const bytes = await res.arrayBuffer()
    const ctx = new AudioContext()
    const buffer = await ctx.decodeAudioData(bytes)
    return { ok: true, seconds: Math.round(buffer.duration * 100) / 100 }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}
</script></body></html>`

const pageHost = await new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(PAGE)
  })
  server.listen(0, '127.0.0.1', () => resolve(server))
})

const MAIN = `
const { app, BrowserWindow } = require('electron')
const path = require('path')
app.commandLine.appendSwitch('headless')
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false })
  const track = process.env.TRACK_URL
  const out = {}
  await win.loadFile(path.join(__dirname, 'page.html'))
  out.installed = await win.webContents.executeJavaScript('window.tryPlay(' + JSON.stringify(track) + ')')
  await win.loadURL(process.env.PAGE_URL)
  out.fromSource = await win.webContents.executeJavaScript('window.tryPlay(' + JSON.stringify(track) + ')')
  console.log('RESULT ' + JSON.stringify(out))
  app.quit()
})
`

await writeFile(path.join(dir, 'page.html'), PAGE)
await writeFile(path.join(dir, 'main.js'), MAIN)
await writeFile(path.join(dir, 'package.json'), JSON.stringify({ name: 'cors-check', main: 'main.js' }))

const child = spawn(electron, [dir], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    TRACK_URL: `http://127.0.0.1:${host.port}/music/${file}`,
    PAGE_URL: `http://localhost:${pageHost.address().port}/`
  }
})
child.stdout.on('data', (d) => process.stdout.write(d))
child.stderr.on('data', (d) => process.stderr.write(d))
await new Promise((resolve) => child.on('exit', resolve))

ws.close()
await host.close()
pageHost.close()
await rm(dir, { recursive: true, force: true })
process.exit(0)
