import { app, BrowserWindow } from 'electron'

const url = 'https://www.raylight.app/projects'

app.on('web-contents-created', (_event, contents) => {
  contents.on('console-message', event => console.log(`PAGE ${event.level} ${event.message}`))
})

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false, webviewTag: true }
  })
  const html = `<webview id="view" src="${url}" style="position:absolute;inset:0;width:100%;height:100%"></webview>`
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  const view = window.webContents.hostWebContents
  const result = await window.webContents.executeJavaScript(`new Promise(resolve => {
    const view = document.getElementById('view')
    let settled = false
    const done = async event => {
      if (settled) return
      settled = true
      try {
        resolve({
          event,
          url: view.getURL(),
          title: view.getTitle(),
          body: await view.executeJavaScript('document.body.innerText.slice(0, 2000)'),
          html: await view.executeJavaScript('document.getElementById("root").outerHTML.slice(0, 2000)')
        })
      } catch (error) {
        resolve({ event, url: view.getURL(), error: String(error) })
      }
    }
    view.addEventListener('did-finish-load', () => setTimeout(() => done('finish'), 5000), { once: true })
    view.addEventListener('did-fail-load', event => done('fail:' + event.errorCode + ':' + event.errorDescription), { once: true })
    setTimeout(() => done('timeout'), 30000)
  })`)
  console.log(`CHECK ${JSON.stringify(result)}`)
  app.exit(0)
}).catch(error => {
  console.log(`CHECK ${JSON.stringify({ error: String(error) })}`)
  app.exit(1)
})
