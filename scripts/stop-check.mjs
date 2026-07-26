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

const html = `<!doctype html><meta charset="utf-8">
<body style="margin:0;padding:28px;background:#141414;font:13px system-ui">
${row('send, w-5', round(arrow(20)))}
${row('stop now, w-5 at 16', round(stop(20)))}
${row('stop before, w-4 at 15', round(old(16)))}
<div style="height:1px;background:#2a2a2a;margin:6px 0 22px"></div>
${row('agent card row, w-4', `<div style="display:flex;gap:4px;color:#a0a0a0">
  ${svg(16, '<path d="M4.6 19.4 5.3 15.8 15.9 5.2a2.3 2.3 0 0 1 3.2 3.2L8.5 19Z"/><path d="m14.4 6.7 3.2 3.2"/>', 2)}
  ${stop(16)}
</div>`)}
</body>`

app.commandLine.appendSwitch('disable-gpu')

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 460, height: 300, show: false, backgroundColor: '#141414' })
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  const shot = await win.webContents.capturePage()
  writeFileSync('stop-check.png', shot.toPNG())
  app.quit()
})
