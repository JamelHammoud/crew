import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))

const PAGE = mesh => `<!doctype html><html><body style="margin:0">
<script>${mesh}</script>
<script>
window.shoot = frames => frames.map(frame => {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = frame.width
    canvas.height = frame.height
    window.CrewMesh.frame(canvas, frame.at)
    return { at: frame.at, png: canvas.toDataURL('image/png') }
  } catch (error) {
    return { at: frame.at, png: null, why: String((error && error.message) || error) }
  }
})
</script>
</body></html>`

const MAIN = `import { app, BrowserWindow } from 'electron'
import { writeFileSync } from 'node:fs'
import path from 'node:path'

app.disableHardwareAcceleration = undefined
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1400, height: 900, webPreferences: { nodeIntegration: true, contextIsolation: false, offscreen: false } })
  await window.loadFile(path.join(import.meta.dirname, 'mesh.html'))
  const frames = JSON.parse(process.env.MESH_FRAMES)
  const shot = await window.webContents.executeJavaScript('window.shoot(' + JSON.stringify(frames) + ')')
  writeFileSync(process.env.MESH_OUT, JSON.stringify(shot))
  console.log('MESH_DONE')
  app.exit(0)
}).catch(error => {
  console.log('MESH_FAILED ' + String((error && error.stack) || error))
  app.exit(1)
})
`

export async function shootMesh(frames) {
  const dir = await mkdtemp(path.join(tmpdir(), 'crew-dmg-mesh-'))
  try {
    const mesh = await readFile(path.join(here, 'dmg-mesh.js'), 'utf8')
    await writeFile(path.join(dir, 'mesh.html'), PAGE(mesh))
    await writeFile(path.join(dir, 'main.mjs'), MAIN)
    const out = path.join(dir, 'shot.json')
    await new Promise((resolve, reject) => {
      const child = spawn(electron, [path.join(dir, 'main.mjs')], {
        env: { ...process.env, MESH_FRAMES: JSON.stringify(frames), MESH_OUT: out },
        stdio: ['ignore', 'pipe', 'pipe']
      })
      let text = ''
      child.stdout.on('data', chunk => (text += chunk))
      child.stderr.on('data', chunk => (text += chunk))
      const timer = setTimeout(() => {
        child.kill('SIGKILL')
        reject(new Error('the mesh never came back'))
      }, 120_000)
      child.on('exit', () => {
        clearTimeout(timer)
        const failed = text.split('\n').find(line => line.startsWith('MESH_FAILED '))
        if (failed) return reject(new Error(failed.slice(12)))
        if (!text.includes('MESH_DONE')) return reject(new Error(`nothing came back:\n${text}`))
        resolve()
      })
    })
    const shot = JSON.parse(await readFile(out, 'utf8'))
    const missing = shot.filter(one => !one.png).map(one => one.at)
    if (missing.length) throw new Error(`no picture at ${missing.join(', ')}`)
    return shot.map(one => ({ ...one, png: one.png.slice(one.png.indexOf(',') + 1) }))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
