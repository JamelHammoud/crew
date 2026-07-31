import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const build = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).build
const dmg = build.dmg
const NAME = 'Crew'
const VOLUME = 'Crew installer check'
const SPOT = { x: 120, y: 120 }

const run = (bin, args) => execFileSync(bin, args, { encoding: 'utf8' }).trim()
const osa = script => run('osascript', ['-e', script])

const work = mkdtempSync(path.join(tmpdir(), 'crew-dmg-check-'))
const stage = path.join(work, 'stage')
const app = path.join(stage, `${NAME}.app`)
mkdirSync(path.join(app, 'Contents/MacOS'), { recursive: true })
mkdirSync(path.join(app, 'Contents/Resources'), { recursive: true })
mkdirSync(path.join(stage, '.background'), { recursive: true })

writeFileSync(path.join(app, 'Contents/MacOS', NAME), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
writeFileSync(
  path.join(app, 'Contents/Info.plist'),
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>${NAME}</string>
  <key>CFBundleExecutable</key><string>${NAME}</string>
  <key>CFBundleIdentifier</key><string>com.jamel.crew.check</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleIconFile</key><string>icon</string>
</dict></plist>
`
)
cpSync(path.join(root, 'resources/icon.icns'), path.join(app, 'Contents/Resources/icon.icns'))
cpSync(path.join(root, dmg.background), path.join(stage, '.background/background.tiff'))
symlinkSync('/Applications', path.join(stage, 'Applications'))

const image = path.join(work, 'check.dmg')
run('hdiutil', [
  'create',
  '-srcfolder',
  stage,
  '-volname',
  VOLUME,
  '-fs',
  'HFS+',
  '-format',
  'UDRW',
  '-ov',
  image
])
run('hdiutil', ['attach', image, '-nobrowse', '-noverify', '-noautoopen'])

const mount = `/Volumes/${VOLUME}`
const app_ = `${NAME}.app`
osa(`tell application "Finder"
  tell disk "${VOLUME}"
    open
    set current view of container window to icon view
    set toolbar visible of container window to false
    set statusbar visible of container window to false
    set the bounds of container window to {${SPOT.x}, ${SPOT.y}, ${SPOT.x + dmg.window.width}, ${SPOT.y + dmg.window.height}}
    set options to the icon view options of container window
    set arrangement of options to not arranged
    set icon size of options to ${dmg.iconSize}
    set text size of options to ${dmg.iconTextSize}
    set background picture of options to file ".background:background.tiff"
    set position of item "${app_}" of container window to {${dmg.contents[0].x}, ${dmg.contents[0].y}}
    set position of item "Applications" of container window to {${dmg.contents[1].x}, ${dmg.contents[1].y}}
    close
    open
    update without registering applications
  end tell
  activate
end tell`)

execFileSync('sleep', ['3'])

const shot = path.join(work, 'screen.png')
const out = path.join(tmpdir(), 'crew-dmg-check.png')
run('screencapture', ['-x', '-o', shot])
const scale = Number(run('osascript', ['-e', 'tell application "Finder" to get 1']) ? 2 : 2)
const box = osa(`tell application "Finder" to get the bounds of the container window of disk "${VOLUME}"`)
const [left, top, right, bottom] = box.split(', ').map(Number)
run('sips', [
  '-c',
  String((bottom - top) * scale),
  String((right - left) * scale),
  '--cropOffset',
  String(top * scale),
  String(left * scale),
  shot,
  '--out',
  out
])

osa(`tell application "Finder" to close every window`)
run('hdiutil', ['detach', mount, '-force'])
rmSync(work, { recursive: true, force: true })

console.log(out)
console.log(`window ${right - left}x${bottom - top}, background ${dmg.window.width}x${dmg.window.height}`)
