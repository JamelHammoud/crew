import { app, BrowserWindow, dialog, ipcMain, powerSaveBlocker } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AppSession, type NewAgent } from './session'

app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.commandLine.appendSwitch('disable-renderer-backgrounding')

const dirname = path.dirname(fileURLToPath(import.meta.url))
const session = new AppSession()

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#141414',
    title: 'crew',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 27 },
    webPreferences: {
      preload: path.join(dirname, '../preload/preload.mjs'),
      contextIsolation: true,
      sandbox: false
    }
  })
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    win.loadURL(devUrl)
  } else {
    win.loadFile(path.join(dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  powerSaveBlocker.start('prevent-app-suspension')
  session.setAgentsPath(path.join(app.getPath('userData'), 'agents.json'))
  ipcMain.handle('folder:pick', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })
  ipcMain.handle('session:start', (_event, folder: string, name: string) => session.startHost(folder, name))
  ipcMain.handle('session:join', (_event, link: string, folder: string, name: string) => session.startJoin(link, folder, name))
  ipcMain.handle('session:leave', () => session.leave())
  ipcMain.handle('agents:capabilities', () => session.capabilities())
  ipcMain.handle('agents:create', (_event, input: NewAgent) => session.createAgent(input))
  ipcMain.handle('agents:remove', (_event, instanceId: string) => session.removeAgent(instanceId))
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  void session.leave()
})
