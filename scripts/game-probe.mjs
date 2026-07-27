import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const out = path.join(root, 'game-probe.png')

const entry = `
import { drawCover } from '${root}/src/renderer/src/components/game/GameCover'
import { paintTetris } from '${root}/src/renderer/src/components/game/drawTetris'
import { paintFlappy } from '${root}/src/renderer/src/components/game/drawFlappy'
import { newTetris, hardDrop, moveBy } from '${root}/src/renderer/src/components/game/tetris'
import { newFlappy, tick, flap } from '${root}/src/renderer/src/components/game/flappy'
window.Probe = {
  drawCover,
  paintTetris,
  paintFlappy,
  newTetris,
  hardDrop,
  moveBy,
  newFlappy,
  tick,
  flap
}
`

const PAGE = `<!doctype html><html><body style="margin:0;background:#141414">
<style>#marks svg { width: 100%; height: 100%; display: block }</style>
<script src="probe.js"></script>
<div id="marks" style="display:flex;gap:28px;padding:24px;color:#fff;align-items:center">__MARKS__</div>
<div id="tiles" style="display:flex;gap:20px;padding:0 24px 24px;align-items:flex-start"></div>
<script>
const P = window.Probe
const { drawCover, paintTetris, paintFlappy } = P
const tiles = document.getElementById('tiles')
for (const [id, w, h] of [['tetris', 84, 54], ['flappy', 84, 54], ['tetris', 252, 162], ['flappy', 252, 162]]) {
  const c = document.createElement('canvas')
  c.width = w * 2; c.height = h * 2
  c.style.width = w + 'px'; c.style.height = h + 'px'
  c.style.borderRadius = '10px'
  const ctx = c.getContext('2d')
  ctx.setTransform(2, 0, 0, 2, 0, 0)
  drawCover(id, ctx, w, h)
  tiles.appendChild(c)
}
let game = P.newTetris()
for (let i = 0; i < 14; i++) game = P.hardDrop(P.moveBy(game, (i % 5) - 2))
const board = document.createElement('canvas')
board.style.width = '160px'; board.style.height = '320px'
board.style.background = '#141a2b'
board.style.borderRadius = '14px'
tiles.appendChild(board)
paintTetris(board, game)

let bird = P.flap(P.newFlappy())
for (let i = 0; i < 150; i++) {
  if (i % 22 === 0) bird = P.flap(bird)
  bird = P.tick(bird, 1 / 60)
}
const sky = document.createElement('canvas')
sky.style.width = '213px'; sky.style.height = '320px'
sky.style.borderRadius = '14px'
tiles.appendChild(sky)
paintFlappy(sky, bird)
</script>
</body></html>`

const MAIN = `import { app, BrowserWindow } from 'electron'
import { writeFileSync } from 'node:fs'
import path from 'node:path'

app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1320, height: 640, webPreferences: { nodeIntegration: true, contextIsolation: false } })
  await window.loadFile(path.join(import.meta.dirname, 'probe.html'))
  await new Promise(done => setTimeout(done, 400))
  const image = await window.webContents.capturePage()
  writeFileSync(process.env.PROBE_OUT, image.toPNG())
  app.quit()
})
`

const MARKS_ENTRY = `
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import * as icons from '${root}/src/renderer/src/icons'
export const sheet = () =>
  ['GameGlyph', 'SignalGlyph', 'TerminalGlyph', 'FolderGlyph', 'MusicGlyph', 'ToolboxGlyph']
    .map(name => [48, 22, 16]
      .map(size =>
        '<span style="display:block;width:' + size + 'px;height:' + size + 'px">' +
        renderToStaticMarkup(createElement(icons[name], { className: 'w-[' + size + 'px] h-[' + size + 'px]' })) +
        '</span>')
      .join(''))
    .map(art => '<div style="display:flex;flex-direction:column;gap:10px;align-items:center">' + art + '</div>')
    .join('')
`

const dir = await mkdtemp(path.join(root, 'node_modules', '.crew-game-probe-'))
try {
  const src = path.join(dir, 'entry.jsx')
  await writeFile(src, entry)
  await build({
    entryPoints: [src],
    bundle: true,
    outfile: path.join(dir, 'probe.js'),
    format: 'iife',
    platform: 'browser',
    loader: { '.js': 'jsx', '.ts': 'ts', '.tsx': 'tsx' },
    define: { 'process.env.NODE_ENV': '"production"' }
  })
  const marksSrc = path.join(dir, 'marks.jsx')
  await writeFile(marksSrc, MARKS_ENTRY)
  await build({
    entryPoints: [marksSrc],
    bundle: true,
    outfile: path.join(dir, 'marks.mjs'),
    format: 'esm',
    platform: 'node',
    packages: 'external',
    loader: { '.js': 'jsx', '.ts': 'ts', '.tsx': 'tsx' },
    define: { 'process.env.NODE_ENV': '"production"' }
  })
  const { sheet } = await import(path.join(dir, 'marks.mjs'))
  console.log('marks', sheet().length)
  await writeFile(path.join(dir, 'probe.html'), PAGE.replace('__MARKS__', sheet()))
  await writeFile(path.join(dir, 'main.mjs'), MAIN)
  await writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'probe', main: 'main.mjs', type: 'module' })
  )
  await new Promise((done, fail) => {
    const child = spawn(electron, [dir], { stdio: 'inherit', env: { ...process.env, PROBE_OUT: out } })
    child.on('exit', code => (code === 0 ? done() : fail(new Error('electron exited ' + code))))
  })
  console.log(out)
} finally {
  await rm(dir, { recursive: true, force: true })
}
