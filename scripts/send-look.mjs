import { spawn } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import electron from 'electron'

const shot = path.join(tmpdir(), 'crew-send-look.png')

const SPARK =
  'M12 2.75c1.09 4.24 5 8.16 9.25 9.25-4.24 1.09-8.16 5-9.25 9.25-1.09-4.24-5-8.16-9.25-9.25 4.24-1.09 8.16-5 9.25-9.25Z'
const CHAT = [
  'M11.48 20.55A8.8 8.8 0 1 0 3.73 13.33L4 20.81Z',
  'M8.15 11.8a4.25 4.25 0 0 0 8.5 0'
]

const SEND = [
  'M19.86 2.56L3.27 8.3Q1.45 8.93 3.25 9.61L9.81 12.12Q11.3 12.7 11.88 14.19L14.39 20.75Q15.07 22.55 15.7 20.73L21.44 4.14Q22.28 1.72 19.86 2.56Z',
  'M20.08 3.92L11.3 12.7'
]

const ROWS = [
  { name: 'Spark', art: [SPARK] },
  { name: 'Chat', art: CHAT },
  { name: 'Send', art: SEND }
]

const SIZES = [48, 24, 20, 16]
const weight = px => (px <= 14 ? 2.1 : px <= 21 ? 2 : px <= 27 ? 1.8 : 1.6)

const svg = (art, px) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${px}" height="${px}" fill="none" stroke="currentColor" stroke-width="${weight(px)}" stroke-linecap="round" stroke-linejoin="round">${art.map(d => `<path d="${d}"></path>`).join('')}</svg>`

const tile = row =>
  `<div style="width:104px;height:104px;border-radius:18px;background:#161719;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#f5f5f5">${svg(row.art, 20)}<span style="font-size:11px;color:#8b8d91">${row.name}</span></div>`

const page = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#0c0d0e;color:#f5f5f5;font:13px -apple-system,system-ui,sans-serif;padding:28px">
<table style="border-collapse:collapse">
<tr><th></th>${SIZES.map(s => `<th style="padding:8px 22px;font-weight:400;color:#8b8d91">${s}</th>`).join('')}</tr>
${ROWS.map(
  row =>
    `<tr><td style="padding:10px 22px 10px 0;color:#8b8d91">${row.name}</td>${SIZES.map(
      s => `<td style="padding:10px 22px;text-align:center">${svg(row.art, s)}</td>`
    ).join('')}</tr>`
).join('')}
</table>
<div style="display:flex;gap:10px;margin-top:28px">${ROWS.map(tile).join('')}</div>
<div style="display:flex;gap:22px;margin-top:24px;align-items:center;color:#f5f5f5">
${ROWS.map(row => svg(row.art, 16)).join('')}
</div>
<div style="margin-top:24px;background:#f7f7f8;color:#111;padding:18px;border-radius:16px;display:flex;gap:26px;align-items:center">
${ROWS.map(row => svg(row.art, 20)).join('')}${ROWS.map(row => svg(row.art, 16)).join('')}
</div>
</body>`

const dir = await mkdtemp(path.join(tmpdir(), 'send-look-'))
const file = path.join(dir, 'look.html')
await writeFile(file, page)

const MAIN = `
const { app, BrowserWindow } = require('electron')
const { writeFileSync } = require('fs')
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 820, height: 620, show: false, backgroundColor: '#0c0d0e' })
  await win.loadFile(${JSON.stringify(file)})
  await new Promise(r => setTimeout(r, 400))
  const png = await win.capturePage()
  writeFileSync(${JSON.stringify(shot)}, png.toPNG())
  app.quit()
})
`
const main = path.join(dir, 'main.cjs')
await writeFile(main, MAIN)
await writeFile(path.join(dir, 'package.json'), JSON.stringify({ name: 'send-look', main: 'main.cjs' }))

await new Promise((done, fail) => {
  const run = spawn(electron, [dir], { stdio: 'inherit' })
  run.on('exit', code => (code === 0 ? done() : fail(new Error(`electron ${code}`))))
})
console.log(shot)
