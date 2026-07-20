import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const electronPkg = require.resolve('electron/package.json')
const electronDir = path.dirname(electronPkg)
const { version } = require(electronPkg)

const platformPath =
  process.platform === 'darwin'
    ? 'Electron.app/Contents/MacOS/Electron'
    : process.platform === 'win32'
      ? 'electron.exe'
      : 'electron'

const pathFile = path.join(electronDir, 'path.txt')
const versionFile = path.join(electronDir, 'dist', 'version')

const ready =
  fs.existsSync(pathFile) &&
  fs.existsSync(versionFile) &&
  fs.readFileSync(versionFile, 'utf8').replace(/^v/, '').trim() === version

if (!ready) {
  const { downloadArtifact } = require('@electron/get')
  const extract = require('extract-zip')
  const zipPath = await downloadArtifact({ version, artifactName: 'electron' })
  await extract(zipPath, { dir: path.join(electronDir, 'dist') })
  fs.writeFileSync(pathFile, platformPath)
  console.log('electron binary ready')
}
