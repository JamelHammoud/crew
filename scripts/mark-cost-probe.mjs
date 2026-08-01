import { spawn } from 'node:child_process'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import electron from 'electron'

const ART = '<path d="M12 20V4"/><path d="m6.5 9.5 5.5-5.5 5.5 5.5"/>'
const COUNT = 800

const plain = i =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ART}</svg>`

const masked = i =>
  `<svg viewBox="0 0 24 24">
     <mask id="k${i}" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
       <g style="color:#fff" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ART}</g>
     </mask>
     <rect width="24" height="24" fill="currentColor" mask="url(#k${i})"/>
   </svg>`

const wall = (id, make) =>
  `<div id="${id}" class="wall">${Array.from({ length: COUNT }, (_, i) => make(i)).join('')}</div>`

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin:0; background:#0a0a0b; color:rgba(255,255,255,0.45); }
  .wall { display:flex; flex-wrap:wrap; width:1200px; }
  .wall svg { width:16px; height:16px; }
  .off { display:none; }
</style></head><body>
${wall('plain', plain)}
${wall('masked', masked)}
</body></html>`

const MAIN = `const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const wait = ms => new Promise(r => setTimeout(r, ms))

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1240, height: 900, show: true })
  try {
    await win.loadFile(path.join(__dirname, 'page.html'))
    await wait(800)
    const seen = await win.webContents.executeJavaScript(\`(async () => {
      const time = async id => {
        const wall = document.getElementById(id)
        const other = document.getElementById(id === 'plain' ? 'masked' : 'plain')
        other.classList.add('off')
        wall.classList.remove('off')
        // Warm it, then force a real repaint of the whole wall each round.
        const round = () => new Promise(done => {
          wall.style.opacity = String(0.4 + Math.random() * 0.2)
          requestAnimationFrame(() => requestAnimationFrame(() => done()))
        })
        for (let i = 0; i < 5; i++) await round()
        const at = performance.now()
        for (let i = 0; i < 40; i++) await round()
        return (performance.now() - at) / 40
      }
      const plain = await time('plain')
      const masked = await time('masked')
      const plainAgain = await time('plain')
      return JSON.stringify({ plain, masked, plainAgain, count: document.querySelectorAll('#masked svg').length })
    })()\`)
    console.log('SEEN ' + seen)
  } catch (e) {
    console.log('SEEN ' + JSON.stringify({ failed: String(e && e.message) }))
  }
  app.exit(0)
})`

const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-cost-')))
await writeFile(path.join(dir, 'page.html'), PAGE)
await writeFile(path.join(dir, 'main.cjs'), MAIN)

const seen = await new Promise((resolve, reject) => {
  const child = spawn(electron, [path.join(dir, 'main.cjs')], { stdio: ['ignore', 'pipe', 'pipe'] })
  let out = ''
  child.stdout.on('data', chunk => (out += chunk))
  child.stderr.on('data', () => {})
  child.on('exit', () => {
    const line = out.split('\n').find(row => row.startsWith('SEEN '))
    if (!line) return reject(new Error('the window said nothing back'))
    resolve(JSON.parse(line.slice(5)))
  })
  child.on('error', reject)
})
await rm(dir, { recursive: true, force: true })

if (seen.failed) throw new Error(seen.failed)
const ms = n => `${Math.round(n * 100) / 100}ms`
console.log(`${seen.count} marks on the page, repainted whole`)
console.log(`  plain   ${ms(seen.plain)} a frame  (again: ${ms(seen.plainAgain)})`)
console.log(`  masked  ${ms(seen.masked)} a frame`)
const base = Math.min(seen.plain, seen.plainAgain)
console.log(`  the mask costs ${ms(seen.masked - base)} a frame across ${seen.count} marks`)
