import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import electron from 'electron'

// The Gradient icon is a real generated cover rather than a drawing of one, so
// it is photographed by the same shader the music is: a fragment shader in a
// real GL context, which is the only place it runs at all. Electron is what has
// one, the way the cover sheet does it.

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const ENTRY = `
import { coverFor } from '${root}/src/renderer/src/components/art/coverArt'
import { coverArt } from '${root}/src/renderer/src/components/art/coverSeed'
import { paletteFor } from '${root}/src/shared/art'
window.CrewCovers = { coverFor, coverArt, paletteFor }
`

const PAGE = `<!doctype html><html><body style="margin:0"><script src="covers.js"></script><script>
window.shoot = ids => {
  const { coverFor, coverArt, paletteFor } = window.CrewCovers
  return ids.map(id => {
    const subject = { id, colors: paletteFor(id) }
    const art = coverFor(subject)
    const seed = coverArt(subject)
    return {
      id,
      png: art ? art.toDataURL('image/png') : null,
      cast: seed.cast,
      petals: seed.petals.length
    }
  })
}
</script></body></html>`

const MAIN = `import { app, BrowserWindow } from 'electron'
import { writeFileSync } from 'node:fs'
import path from 'node:path'

app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 900, height: 900, webPreferences: { nodeIntegration: true, contextIsolation: false } })
  await window.loadFile(path.join(import.meta.dirname, 'covers.html'))
  const ids = JSON.parse(process.env.COVER_IDS)
  const shot = await window.webContents.executeJavaScript('window.shoot(' + JSON.stringify(ids) + ')')
  writeFileSync(process.env.COVER_OUT, JSON.stringify(shot))
  console.log('COVERS_DONE')
  app.exit(0)
}).catch(error => {
  console.log('COVERS_FAILED ' + String((error && error.stack) || error))
  app.exit(1)
})
`

// One Electron for however many are asked for, because standing a GL context up
// is the whole cost and the shader itself is a frame.
export async function shootCovers(ids) {
  const dir = await mkdtemp(path.join(tmpdir(), 'crew-icon-cover-'))
  try {
    await writeFile(path.join(dir, 'entry.ts'), ENTRY)
    await build({
      entryPoints: [path.join(dir, 'entry.ts')],
      bundle: true,
      format: 'iife',
      outfile: path.join(dir, 'covers.js'),
      logLevel: 'error'
    })
    await writeFile(path.join(dir, 'covers.html'), PAGE)
    await writeFile(path.join(dir, 'main.mjs'), MAIN)
    const out = path.join(dir, 'shot.json')
    await new Promise((resolve, reject) => {
      const child = spawn(electron, [path.join(dir, 'main.mjs')], {
        env: { ...process.env, COVER_IDS: JSON.stringify(ids), COVER_OUT: out },
        stdio: ['ignore', 'pipe', 'pipe']
      })
      let text = ''
      child.stdout.on('data', chunk => (text += chunk))
      child.stderr.on('data', chunk => (text += chunk))
      const timer = setTimeout(() => {
        child.kill('SIGKILL')
        reject(new Error('the cover never came back'))
      }, 120_000)
      child.on('exit', () => {
        clearTimeout(timer)
        const failed = text.split('\n').find(line => line.startsWith('COVERS_FAILED '))
        if (failed) return reject(new Error(failed.slice(14)))
        if (!text.includes('COVERS_DONE')) return reject(new Error(`nothing came back:\n${text}`))
        resolve()
      })
    })
    const shot = JSON.parse(await readFile(out, 'utf8'))
    const missing = shot.filter(one => !one.png).map(one => one.id)
    if (missing.length) throw new Error(`no picture for ${missing.join(', ')}`)
    return shot
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
