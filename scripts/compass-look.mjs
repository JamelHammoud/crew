import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const ART = {
  Compass:
    '<path d="M2.75 12A9.25 9.25 0 0 1 21.25 12A9.25 9.25 0 0 1 2.75 12Z"/><path d="M16.25 7.75 13.5 13.5l-5.75 2.75L10.5 10.5Z" fill="currentColor" stroke="none"/>',
  Globe:
    '<path d="M2.75 12A9.25 9.25 0 0 1 21.25 12A9.25 9.25 0 0 1 2.75 12ZM8 12A4 9.25 0 0 1 16 12A4 9.25 0 0 1 8 12ZM2.75 12H21.25"/>',
  PanelRight: '<rect x="2.5" y="4.5" width="19" height="15" rx="3"/><path d="M15 4.5v15"/>',
  Plug:
    '<path d="M9 3v4M15 3v4M6.5 7h11v4.5a5.5 5.5 0 0 1-11 0Z"/><path d="M12 17v4"/>',
  Toolbox:
    '<rect x="2.5" y="7.5" width="19" height="13" rx="3"/><path d="M8.5 7.5V6A2.5 2.5 0 0 1 11 3.5h2A2.5 2.5 0 0 1 15.5 6v1.5"/><path d="M2.5 13h19"/>'
}

const weight = px => (px <= 14 ? 2.1 : px <= 21 ? 2 : px <= 27 ? 1.8 : 1.6)

const svg = (name, px) =>
  `<svg viewBox="0 0 24 24" width="${px}" height="${px}" fill="none" stroke="currentColor" stroke-width="${weight(px)}" stroke-linecap="round" stroke-linejoin="round">${ART[name]}</svg>`

const row = px =>
  `<div class="row"><span class="px">${px}</span>${Object.keys(ART)
    .map(name => `<span class="cell">${svg(name, px)}</span>`)
    .join('')}</div>`

const menu = `<div class="menu">
  ${['Plugins:Plug', 'Browser:Compass', 'Toolbox:Toolbox']
    .map(pair => {
      const [label, name] = pair.split(':')
      return `<div class="item"><span class="mark">${svg(name, 16)}</span>${label}</div>`
    })
    .join('')}
</div>`

const page = `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;background:#0b0b0c;color:#fff;font:13px/1.4 -apple-system,system-ui,sans-serif}
  .wrap{padding:24px;display:flex;gap:40px;align-items:flex-start}
  .head{display:flex;gap:0;margin-left:34px}
  .head span{width:64px;text-align:center;font-size:11px;color:rgba(255,255,255,.45)}
  .row{display:flex;align-items:center;margin-bottom:14px}
  .px{width:34px;font-size:11px;color:rgba(255,255,255,.45)}
  .cell{width:64px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.7)}
  .menu{width:190px;padding:6px;border-radius:16px;background:rgba(38,38,42,.92);
        box-shadow:0 12px 40px rgba(0,0,0,.5)}
  .item{display:flex;align-items:center;gap:10px;height:34px;padding:0 10px;border-radius:10px;
        color:rgba(255,255,255,.7);font-weight:500}
  .item:nth-child(2){background:rgba(255,255,255,.08);color:#fff}
  .mark{display:flex;color:rgba(255,255,255,.45)}
  .item:nth-child(2) .mark{color:rgba(255,255,255,.7)}
</style>
<div class="wrap">
  <div>
    <div class="head">${Object.keys(ART).map(n => `<span>${n}</span>`).join('')}</div>
    ${[48, 24, 20, 16, 14].map(row).join('')}
  </div>
  ${menu}
</div>`

const main = `const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 760, height: 340, show: false, backgroundColor: '#0b0b0c' })
  await win.loadFile(process.argv[2])
  await new Promise(done => setTimeout(done, 400))
  const shot = await win.webContents.capturePage()
  fs.writeFileSync(process.argv[3], shot.toPNG())
  app.quit()
})`

const dir = await mkdtemp(path.join(tmpdir(), 'compass-'))
const html = path.join(dir, 'look.html')
const entry = path.join(dir, 'main.cjs')
const shot = path.join(root, '.compass-look.png')
await writeFile(html, page)
await writeFile(entry, main)

await new Promise((done, fail) => {
  const run = spawn(electron, [entry, html, shot], { stdio: 'inherit' })
  run.on('exit', code => (code === 0 ? done() : fail(new Error(`electron exited ${code}`))))
})
await rm(dir, { recursive: true, force: true })
console.log(shot)
