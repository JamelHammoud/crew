import { app, BrowserWindow } from 'electron'
import { writeFileSync } from 'node:fs'

const sans = '-apple-system,BlinkMacSystemFont,system-ui,sans-serif'
const mono = 'ui-monospace,SFMono-Regular,Menlo,monospace'

const output = [
  'yarn run v1.22.22',
  '$ tsc --noEmit',
  'src/renderer/src/components/StepCode.tsx(31,7): error TS2322:',
  "  Type 'string' is not assignable to type 'number'.",
  'src/runner/providers/output.ts(18,3): error TS2532:',
  '  Object is possibly undefined.',
  'error Command failed with exit code 2.',
  'info Visit https://yarnpkg.com/en/docs/cli/run for documentation.'
].join('\n')

const row = `
<div style="display:flex;align-items:center;gap:10px;padding:4px 12px 4px 8px;font-family:${sans};font-size:13px">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6a6a6a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7l4 4-4 4"/><path d="M12 15h8"/></svg>
  <span style="color:#8a8a8a">Ran</span>
  <span style="font-family:${mono};font-size:11px;color:#5c5c5c;position:relative;top:1px">yarn tsc --noEmit</span>
  <svg width="14" height="14" viewBox="0 0 20 20" fill="#4a4a4a"><path d="M7 5l5 5-5 5" stroke="#4a4a4a" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
</div>`

const copy = `<span style="position:absolute;top:4px;right:4px;padding:4px;color:#4a4a4a">
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 5.5A2.5 2.5 0 0012.5 3h-6A3.5 3.5 0 003 6.5v6A2.5 2.5 0 005.5 15"/></svg>
</span>`

const card = `
<div style="margin:8px 0 0 56px;position:relative;overflow:hidden;border-radius:12px;border:1px solid #262626;background:#1a1a1a">
  <div style="padding:8px 0;font-family:${mono};font-size:11px;line-height:20px">
    <div style="display:flex;padding:0 12px">
      <span style="width:16px;flex:none;color:#4a4a4a">$</span>
      <span style="white-space:pre;color:#a8a8a8;padding-right:40px">yarn tsc --noEmit</span>
    </div>
  </div>
  ${copy}
  <div style="position:relative;border-top:1px solid #262626">
    <div style="max-height:240px;overflow:auto;padding:8px 0;font-family:${mono};font-size:11px;line-height:20px">
      <div style="white-space:pre;padding-left:12px;padding-right:40px;color:#6a6a6a">${output}</div>
    </div>
    ${copy}
  </div>
</div>`

const html = `<!doctype html><html><body style="margin:0;background:#141414;padding:20px 20px 24px">
${row}${card}
</body></html>`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 620, height: 330, show: false, backgroundColor: '#141414' })
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  await new Promise(resolve => setTimeout(resolve, 400))
  writeFileSync('/tmp/card-preview.png', (await win.webContents.capturePage()).toPNG())
  app.quit()
})
