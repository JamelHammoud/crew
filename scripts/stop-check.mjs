import { app, BrowserWindow } from 'electron'
import { writeFileSync } from 'node:fs'

const SOLID = 16
const r = Math.round(SOLID * 0.15 * 4) / 4
const x = Math.round((24 - SOLID) * 50) / 100

const svg = (cls, art, weight) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${weight}" stroke-linecap="round" stroke-linejoin="round" style="width:${cls}px;height:${cls}px">${art}</svg>`

const stop = px =>
  svg(px, `<rect x="${x}" y="${x}" width="${SOLID}" height="${SOLID}" rx="${r}" fill="currentColor" stroke="none"/>`, 2)
const arrow = px => svg(px, '<path d="M12 20V4"/><path d="m6.5 9.5 5.5-5.5 5.5 5.5"/>', 2)
const old = px =>
  svg(px, `<rect x="4.5" y="4.5" width="15" height="15" rx="2.25" fill="currentColor" stroke="none"/>`, 2)

const round = inner =>
  `<div style="width:40px;height:40px;border-radius:999px;background:#f5f5f5;color:#141414;display:flex;align-items:center;justify-content:center">${inner}</div>`

const row = (label, cells) =>
  `<div style="display:flex;align-items:center;gap:20px;margin-bottom:22px">
     <div style="width:150px;font:12px system-ui;color:#8a8a8a">${label}</div>${cells}</div>`

const at = units => {
  const rr = Math.round(units * 0.15 * 4) / 4
  const xx = Math.round((24 - units) * 50) / 100
  return svg(
    20,
    `<rect x="${xx}" y="${xx}" width="${units}" height="${units}" rx="${rr}" fill="currentColor" stroke="none"/>`,
    2
  )
}

const html = `<!doctype html><meta charset="utf-8">
<body style="margin:0;padding:24px;background:#141414;font:13px system-ui">
${row('send, w-5', round(arrow(20)))}
<div style="height:1px;background:#2a2a2a;margin:2px 0 20px"></div>
${row('before, w-4 at 15', round(old(16)))}
${row('w-5 at 15', round(at(15)))}
${row('w-5 at 16', round(at(16)))}
${row('w-5 at 17', round(at(17)))}
${row('w-5 at 18', round(at(18)))}
</body>`

app.commandLine.appendSwitch('disable-gpu')

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 440, height: 420, show: false, backgroundColor: '#141414' })
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  const shot = await win.webContents.capturePage()
  writeFileSync('stop-check.png', shot.toPNG())
  app.quit()
})
