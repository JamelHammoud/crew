import { app, BrowserWindow, dialog, ipcMain, Menu, powerSaveBlocker, type MenuItemConstructorOptions } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AppSession, type NewAgent } from './session'

app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.commandLine.appendSwitch('disable-renderer-backgrounding')

const dirname = path.dirname(fileURLToPath(import.meta.url))
const session = new AppSession()

// Without an application menu the standard clipboard accelerators (copy, cut,
// paste, select-all, undo, redo) are never registered, so they do nothing
// inside the app. Registering the roles wires them up on every platform.
function installMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    { role: 'fileMenu' },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// Right-click clipboard actions for text fields and the doc editor.
function installContextMenu(win: BrowserWindow): void {
  win.webContents.on('context-menu', (_event, params) => {
    const editable = params.isEditable
    const hasSelection = params.selectionText.trim().length > 0
    if (!editable && !hasSelection) return
    const items: MenuItemConstructorOptions[] = []
    if (editable) items.push({ role: 'cut', enabled: hasSelection })
    if (editable || hasSelection) items.push({ role: 'copy', enabled: hasSelection })
    if (editable) items.push({ role: 'paste' }, { type: 'separator' }, { role: 'selectAll' })
    Menu.buildFromTemplate(items).popup({ window: win })
  })
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    transparent: true,
    backgroundColor: '#00000000',
    title: 'crew',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 27 },
    webPreferences: {
      preload: path.join(dirname, '../preload/preload.mjs'),
      contextIsolation: true,
      sandbox: false
    }
  })
  win.on('enter-full-screen', () => win.webContents.send('window:fullscreen', true))
  win.on('leave-full-screen', () => win.webContents.send('window:fullscreen', false))
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
