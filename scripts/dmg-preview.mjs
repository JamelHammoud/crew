import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { shootCovers } from './icon-cover.mjs'
import {
  DMG,
  DMG_COVERS,
  DMG_DEFS,
  DMG_GRAIN,
  DMG_WASH,
  HEADLINE,
  dmgDiscs,
  dmgOverlay
} from './icon-dmg.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(tmpdir(), 'crew-dmg')
const SIDE = 256
const HOLD = 5.2
const FADE = 2.4
const RUN = 2.9

const geometry = { bite: 28 / 130, step: 186 / 130 }
const shots = (await shootCovers(DMG_COVERS)).filter(shot => shot.png)
const loop = shots.length * HOLD

const folder = () => {
  const png = path.join(out, 'applications.png')
  execFileSync('sips', [
    '-s',
    'format',
    'png',
    '/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/ApplicationsFolderIcon.icns',
    '--out',
    png,
    '-Z',
    String(SIDE)
  ])
  return readFileSync(png).toString('base64')
}

const app = () => {
  const png = path.join(out, 'crew.png')
  execFileSync('sips', ['-Z', String(SIDE), path.join(root, 'resources/icon.png'), '--out', png])
  return readFileSync(png).toString('base64')
}

mkdirSync(out, { recursive: true })
const icons = { app: app(), applications: folder() }

const { masks, drawn } = dmgOverlay(geometry, 'live')
const discs = dmgDiscs(geometry)

const overlay = `<svg class="overlay" viewBox="0 0 ${DMG.width} ${DMG.height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
${DMG_DEFS}
${masks}
  </defs>
${DMG_WASH}
${discs
  .map(
    (disc, index) =>
      `  <circle class="disc" style="--rest:${disc.o};--lag:${((index / discs.length) * RUN * -1).toFixed(2)}s" cx="${disc.x}" cy="${disc.y}" r="${disc.r}" fill="#141414"${disc.cut ? ` mask="url(#live-${index})"` : ''} />`
  )
  .join('\n')}
  ${HEADLINE}
${DMG_GRAIN}
</svg>`

const stage = shots
  .map(
    (shot, index) =>
      `    <img class="ground" style="--lag:${(index * HOLD).toFixed(2)}s" src="${shot.png}" alt="">`
  )
  .join('\n')

const names = shots
  .map(
    (shot, index) =>
      `    <span class="seed" style="--lag:${(index * HOLD).toFixed(2)}s">${shot.id}</span>`
  )
  .join('\n')

const sheet = shots
  .map(
    shot => `    <figure>
      <div class="tile"><img src="${shot.png}" alt=""><span class="mark"></span></div>
      <figcaption>${shot.id}</figcaption>
    </figure>`
  )
  .join('\n')

const still = `<svg class="overlay" viewBox="0 0 ${DMG.width} ${DMG.height}" xmlns="http://www.w3.org/2000/svg"><defs>
${DMG_DEFS}
${dmgOverlay(geometry, 'still').masks}
</defs>
${DMG_WASH}
${dmgOverlay(geometry, 'still').drawn}
${HEADLINE}
${DMG_GRAIN}
</svg>`

writeFileSync(
  path.join(out, 'index.html'),
  `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Crew installer</title>
<style>
  :root { color-scheme: dark; --w: ${DMG.width}px; --h: ${DMG.height}px; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 56px 40px 72px; background: #141414; color: #fff;
    font: 14px ui-sans-serif, system-ui, -apple-system, "SF Pro Text", sans-serif;
    display: flex; flex-direction: column; align-items: center; gap: 14px;
  }
  h1 { font-size: 16px; font-weight: 500; margin: 0; color: #fff; }
  p { margin: 0; color: #707070; font-size: 13px; max-width: 620px; text-align: center; line-height: 1.5; }
  .window {
    position: relative; width: calc(var(--w) * 1.36); height: calc(var(--h) * 1.36);
    border-radius: 12px; overflow: hidden; margin-top: 22px;
    box-shadow: 0 40px 90px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.08);
  }
  .bar {
    position: absolute; inset: 0 0 auto 0; height: 38px; z-index: 3;
    background: rgba(28,28,30,.86); backdrop-filter: blur(20px) saturate(160%);
    border-bottom: 1px solid rgba(255,255,255,.07);
    display: flex; align-items: center; gap: 8px; padding: 0 14px;
    font-size: 12.5px; color: rgba(255,255,255,.62);
  }
  .light { width: 11px; height: 11px; border-radius: 50%; }
  .bar b { font-weight: 500; margin-left: 8px; }
  .pane { position: absolute; inset: 38px 0 0 0; overflow: hidden; }
  .ground {
    position: absolute; left: 50%; top: 50%; width: 128%; height: 128%;
    object-fit: cover; transform-origin: 50% 50%; opacity: 0;
    animation: show ${loop}s linear infinite, breathe 21s ease-in-out infinite alternate;
    animation-delay: var(--lag), calc(var(--lag) * -1.7);
  }
  @keyframes show {
    0% { opacity: 0 }
    ${((FADE / loop) * 100).toFixed(3)}% { opacity: 1 }
    ${((HOLD / loop) * 100).toFixed(3)}% { opacity: 1 }
    ${(((HOLD + FADE) / loop) * 100).toFixed(3)}% { opacity: 0 }
    100% { opacity: 0 }
  }
  @keyframes breathe {
    from { transform: translate(-50%, -50%) scale(1.0) rotate(-1.1deg) }
    to   { transform: translate(-50%, -50%) scale(1.09) rotate(1.1deg) }
  }
  .overlay { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 2; }
  .disc { fill-opacity: var(--rest); animation: run ${RUN}s ease-in-out infinite; animation-delay: var(--lag); }
  @keyframes run {
    0%, 62%, 100% { fill-opacity: var(--rest) }
    26% { fill-opacity: calc(var(--rest) + .22) }
  }
  .icon { position: absolute; z-index: 2; width: ${DMG.iconSize}px; height: ${DMG.iconSize}px; }
  .name {
    position: absolute; z-index: 2; width: 180px; text-align: center; font-size: 12px;
    color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,.5);
  }
  .seeds { position: absolute; z-index: 4; left: 12px; bottom: 10px; height: 16px; }
  .seed {
    position: absolute; left: 0; bottom: 0; white-space: nowrap; opacity: 0;
    font: 11px "SF Mono", Menlo, ui-monospace, monospace; color: rgba(20,20,20,.55);
    animation: show ${loop}s linear infinite; animation-delay: var(--lag);
  }
  .sheet {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
    width: calc(var(--w) * 1.36); margin-top: 34px;
  }
  .sheet figure { margin: 0; }
  .tile { position: relative; aspect-ratio: ${DMG.width} / ${DMG.height}; border-radius: 10px; overflow: hidden; }
  .tile img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .tile .mark { position: absolute; inset: 0; }
  .sheet figcaption {
    margin-top: 7px; font: 11px "SF Mono", Menlo, ui-monospace, monospace; color: #707070;
  }
  .note { margin-top: 30px; }
</style>
</head>
<body>
  <h1>Crew installer</h1>
  <p>Finder paints one still image behind a disk image, so what ships is a single frame. This is the set it is picked from.</p>
  <div class="window">
    <div class="bar">
      <span class="light" style="background:#ff5f57"></span>
      <span class="light" style="background:#febc2e"></span>
      <span class="light" style="background:#28c840"></span>
      <b>Crew</b>
    </div>
    <div class="pane">
${stage}
      ${overlay}
      <img class="icon" style="left:${DMG.app - DMG.iconSize / 2}px;top:${DMG.line - DMG.iconSize / 2}px" src="data:image/png;base64,${icons.app}" alt="">
      <img class="icon" style="left:${DMG.applications - DMG.iconSize / 2}px;top:${DMG.line - DMG.iconSize / 2}px" src="data:image/png;base64,${icons.applications}" alt="">
      <div class="name" style="left:${DMG.app - 90}px;top:${DMG.line + DMG.iconSize / 2 + 6}px">Crew</div>
      <div class="name" style="left:${DMG.applications - 90}px;top:${DMG.line + DMG.iconSize / 2 + 6}px">Applications</div>
      <div class="seeds">
${names}
      </div>
    </div>
  </div>
  <div class="sheet">
${sheet}
  </div>
</body>
</html>
`
)

const scale = 1.36
writeFileSync(
  path.join(out, 'still.html'),
  `<html><body style="margin:0">${still}</body></html>`
)

console.log(path.join(out, 'index.html'))
console.log(`${shots.length} covers, loop ${loop.toFixed(1)}s, window ${DMG.width}x${DMG.height} at ${scale}`)
