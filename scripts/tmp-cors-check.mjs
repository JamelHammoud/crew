import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import http from 'node:http'
import electron from 'electron'

// Does a renderer at another origin get to read a track off the host?

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

const bytes = wav()

const serve = (cors) =>
  new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const headers = { 'content-type': 'audio/wav', 'cache-control': 'public, max-age=31536000, immutable' }
      if (cors) headers['access-control-allow-origin'] = '*'
      res.writeHead(200, headers)
      res.end(bytes)
    })
    server.listen(0, '127.0.0.1', () => resolve(server))
  })

const PAGE = `<!doctype html><html><body><script>
window.tryFetch = async (url) => {
  try {
    const res = await fetch(url)
    const buf = await res.arrayBuffer()
    return { ok: true, status: res.status, bytes: buf.byteLength }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}
</script></body></html>`

const MAIN = `
const { app, BrowserWindow } = require('electron')
const path = require('path')
app.commandLine.appendSwitch('headless')
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  })
  const plain = process.env.PLAIN_URL
  const cors = process.env.CORS_URL
  const out = {}
  await win.loadFile(path.join(__dirname, 'page.html'))
  out.fileOrigin = {
    plain: await win.webContents.executeJavaScript('window.tryFetch(' + JSON.stringify(plain) + ')'),
    withCors: await win.webContents.executeJavaScript('window.tryFetch(' + JSON.stringify(cors) + ')')
  }
  await win.loadURL(process.env.PAGE_URL)
  out.httpOrigin = {
    plain: await win.webContents.executeJavaScript('window.tryFetch(' + JSON.stringify(plain) + ')'),
    withCors: await win.webContents.executeJavaScript('window.tryFetch(' + JSON.stringify(cors) + ')')
  }
  console.log('RESULT ' + JSON.stringify(out))
  app.quit()
})
`

const dir = await mkdtemp(path.join(tmpdir(), 'crew-cors-'))
const plain = await serve(false)
const cors = await serve(true)
await writeFile(path.join(dir, 'page.html'), PAGE)
await writeFile(path.join(dir, 'main.js'), MAIN)
await writeFile(path.join(dir, 'package.json'), JSON.stringify({ name: 'cors-check', main: 'main.js' }))

const child = spawn(electron, [dir], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    PLAIN_URL: `http://127.0.0.1:${plain.address().port}/music/x.wav`,
    CORS_URL: `http://127.0.0.1:${cors.address().port}/music/x.wav`
  }
})
let out = ''
child.stdout.on('data', (d) => {
  out += d
  process.stdout.write(d)
})
child.stderr.on('data', (d) => process.stderr.write(d))
await new Promise((resolve) => child.on('exit', resolve))
plain.close()
cors.close()
await rm(dir, { recursive: true, force: true })
