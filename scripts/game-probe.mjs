import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const out = path.join(root, 'game-probe.png')

const entry = `
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { GameGlyph, MusicGlyph, SignalGlyph, TerminalGlyph, FolderGlyph, ToolboxGlyph } from '${root}/src/renderer/src/icons'
import { drawCover } from '${root}/src/renderer/src/components/game/GameCover'
import { paintTetris } from '${root}/src/renderer/src/components/game/probeDraw'
window.Probe = {
  marks: [GameGlyph, SignalGlyph, TerminalGlyph, FolderGlyph, MusicGlyph, ToolboxGlyph].map(Icon => ({
    at16: renderToStaticMarkup(createElement(Icon, { className: 'w-4 h-4' })),
    at22: renderToStaticMarkup(createElement(Icon, { className: 'w-[22px] h-[22px]' })),
    at48: renderToStaticMarkup(createElement(Icon, { className: 'w-12 h-12' }))
  })),
  drawCover,
  paintTetris
}
`

const PAGE = `<!doctype html><html><body style="margin:0;background:#141414">
<script src="probe.js"></script>
<div id="marks" style="display:flex;gap:28px;padding:24px;color:#fff;align-items:center"></div>
<div id="tiles" style="display:flex;gap:20px;padding:0 24px 24px;align-items:flex-start"></div>
<script>
const { marks, drawCover, paintTetris } = window.Probe
document.getElementById('marks').innerHTML = marks
  .map(m => '<div style="display:flex;flex-direction:column;gap:10px;align-items:center">' + m.at48 + m.at22 + m.at16 + '</div>')
  .join('')
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
const board = document.createElement('canvas')
board.width = 300; board.height = 600
board.style.width = '150px'; board.style.height = '300px'
board.style.borderRadius = '14px'
const bctx = board.getContext('2d')
bctx.setTransform(2, 0, 0, 2, 0, 0)
paintTetris(bctx, 150, 300)
tiles.appendChild(board)
</script>
</body></html>`

const MAIN = `import { app, BrowserWindow } from 'electron'
import { writeFileSync } from 'node:fs'
import path from 'node:path'

app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1100, height: 560, webPreferences: { nodeIntegration: true, contextIsolation: false } })
  await window.loadFile(path.join(import.meta.dirname, 'probe.html'))
  await new Promise(done => setTimeout(done, 400))
  const image = await window.webContents.capturePage()
  writeFileSync(process.env.PROBE_OUT, image.toPNG())
  app.quit()
})
`

const dir = await mkdtemp(path.join(tmpdir(), 'crew-game-probe-'))
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
  await writeFile(path.join(dir, 'probe.html'), PAGE)
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
