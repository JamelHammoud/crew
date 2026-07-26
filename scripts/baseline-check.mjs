import { app, BrowserWindow } from 'electron'

const row = nudge => `
<div style="display:flex;align-items:center;gap:10px;font-size:13px;line-height:20px;color:#8a8a8a;padding:6px 0">
  <span id="sans${nudge}" style="font-size:13px">Ran</span>
  <span id="mono${nudge}" style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:16px;color:#6a6a6a;position:relative;top:${nudge}px">test</span>
</div>`

const html = `<!doctype html><html><body style="margin:0;background:#000;padding:8px;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif">
${[0, 1, 2].map(row).join('')}
</body></html>`

// Where the ink actually stops. Neither word has a descender, so the lowest lit
// row of pixels in each is its baseline, whatever the two faces claim.
const MEASURE = `(() => {
  const bottom = id => {
    const el = document.getElementById(id)
    const box = el.getBoundingClientRect()
    const canvas = document.createElement('canvas')
    const scale = 4
    canvas.width = Math.ceil(box.width * scale)
    canvas.height = Math.ceil(box.height * scale) + 40
    return { box, canvas, scale }
  }
  const out = {}
  for (const n of [0, 1, 2]) {
    out['sans' + n] = document.getElementById('sans' + n).getBoundingClientRect()
    out['mono' + n] = document.getElementById('mono' + n).getBoundingClientRect()
  }
  return JSON.stringify(out)
})()`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 400, height: 160, show: false, backgroundColor: '#000000' })
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  await new Promise(resolve => setTimeout(resolve, 400))

  const image = await win.webContents.capturePage()
  const { width, height } = image.getSize()
  const scale = image.getScaleFactor()
  const bitmap = image.getBitmap()
  const lit = (x, y) => bitmap[(y * width + x) * 4] > 40

  const boxes = JSON.parse(await win.webContents.executeJavaScript(MEASURE))
  const inkBottom = box => {
    const x0 = Math.round(box.left * scale)
    const x1 = Math.round(box.right * scale)
    for (let y = height - 1; y >= 0; y--) {
      for (let x = x0; x < x1; x++) if (lit(x, y)) return y
    }
    return -1
  }
  for (const n of [0, 1, 2]) {
    const sans = inkBottom(boxes['sans' + n])
    const mono = inkBottom(boxes['mono' + n])
    console.log(`nudge ${n}px  sans baseline ${sans}  mono baseline ${mono}  off by ${(mono - sans) / scale}px`)
  }
  app.quit()
})
