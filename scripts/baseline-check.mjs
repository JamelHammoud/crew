import { app, BrowserWindow } from 'electron'
import { writeFileSync } from 'node:fs'

const html = `<!doctype html><html><body style="margin:0;background:#141414;padding:16px;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif">
${[0, 1].map(nudge => `
<div style="display:flex;align-items:center;gap:10px;font-size:13px;line-height:20px;color:#8a8a8a;padding:4px 0">
  <span style="font-size:13px">Ran</span>
  <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:16px;color:#6a6a6a;position:relative;top:${nudge}px">yarn test --run</span>
  <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:16px;position:relative;top:${nudge}px"><span style="color:#4ade80">+28</span> <span style="color:#f87171">−18</span></span>
  <span style="font-size:11px;color:#3a3a3a">nudge ${nudge}px</span>
</div>`).join('')}
</body></html>`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 520, height: 120, show: false, backgroundColor: '#141414' })
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  await new Promise(resolve => setTimeout(resolve, 400))
  const image = await win.webContents.capturePage()
  writeFileSync('/tmp/baseline-check.png', image.toPNG())
  app.quit()
})
