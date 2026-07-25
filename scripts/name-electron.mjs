import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const NAME = 'Crew'

if (process.platform === 'darwin') {
  const require = createRequire(import.meta.url)
  const electronDir = path.dirname(require.resolve('electron/package.json'))
  const bundle = path.join(electronDir, 'dist', 'Electron.app')
  const plist = path.join(bundle, 'Contents', 'Info.plist')

  if (fs.existsSync(plist)) {
    const read = (key) => {
      try {
        return execFileSync('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, plist], {
          encoding: 'utf8'
        }).trim()
      } catch {
        return ''
      }
    }
    const write = (key, value) => {
      const command = read(key) ? `Set :${key} ${value}` : `Add :${key} string ${value}`
      execFileSync('/usr/libexec/PlistBuddy', ['-c', command, plist])
    }

    if (read('CFBundleName') !== NAME || read('CFBundleDisplayName') !== NAME) {
      write('CFBundleName', NAME)
      write('CFBundleDisplayName', NAME)
      const lsregister =
        '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'
      try {
        execFileSync(lsregister, ['-f', bundle])
      } catch {}
      console.log(`electron binary named ${NAME}`)
    }
  }
}
