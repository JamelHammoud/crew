import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const NAME = 'Crew'

if (process.platform === 'darwin') {
  const require = createRequire(import.meta.url)
  const electronDir = path.dirname(require.resolve('electron/package.json'))
  const dist = path.join(electronDir, 'dist')
  const source = path.join(dist, 'Electron.app')
  const bundle = path.join(dist, `${NAME}.app`)
  const executable = path.join(bundle, 'Contents', 'MacOS', NAME)
  const plist = path.join(bundle, 'Contents', 'Info.plist')
  const stamp = path.join(dist, '.named')
  const pathFile = path.join(electronDir, 'path.txt')
  const relative = `${NAME}.app/Contents/MacOS/${NAME}`

  const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : '')
  const version = read(path.join(dist, 'version'))

  if (fs.existsSync(source) && (read(stamp) !== version || !fs.existsSync(executable))) {
    fs.rmSync(bundle, { recursive: true, force: true })
    execFileSync('cp', ['-Rl', source, bundle])
    fs.rmSync(plist, { force: true })
    fs.copyFileSync(path.join(source, 'Contents', 'Info.plist'), plist)
    fs.renameSync(path.join(bundle, 'Contents', 'MacOS', 'Electron'), executable)

    for (const key of ['CFBundleName', 'CFBundleDisplayName', 'CFBundleExecutable']) {
      let command = `Set :${key} ${NAME}`
      try {
        execFileSync('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, plist], { stdio: 'ignore' })
      } catch {
        command = `Add :${key} string ${NAME}`
      }
      execFileSync('/usr/libexec/PlistBuddy', ['-c', command, plist])
    }

    try {
      execFileSync(
        '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister',
        ['-f', bundle]
      )
    } catch {}

    fs.writeFileSync(stamp, version)
    console.log(`electron binary named ${NAME}`)
  }

  if (fs.existsSync(executable) && read(pathFile) !== relative) {
    fs.writeFileSync(pathFile, relative)
  }
}
