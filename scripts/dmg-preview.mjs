import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ARROW, DMG, HEADLINE, LABEL, dmgArrow, dmgDefs } from './icon-dmg.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(tmpdir(), 'crew-dmg')
const SIDE = 256

mkdirSync(out, { recursive: true })

const sip = (from, to, size) => {
  execFileSync('sips', ['-s', 'format', 'png', from, '--out', to, '-Z', String(size)])
  return readFileSync(to).toString('base64')
}

const icons = {
  app: sip(path.join(root, 'resources/icon.png'), path.join(out, 'crew.png'), SIDE),
  applications: sip(
    '/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/ApplicationsFolderIcon.icns',
    path.join(out, 'applications.png'),
    SIDE
  )
}

const mesh = readFileSync(path.join(root, 'scripts/dmg-mesh.js'), 'utf8')
const { DMG_WASH } = await import('./icon-dmg.mjs')

const icon = (data, cx) =>
  `<img class="icon" style="left:${((cx - DMG.iconSize / 2) / DMG.width) * 100}%;top:${((DMG.line - DMG.iconSize / 2) / DMG.height) * 100}%;width:${(DMG.iconSize / DMG.width) * 100}%" src="data:image/png;base64,${data}" alt="">`

const label = (text, cx) =>
  `<div class="name" style="left:${((cx - 90) / DMG.width) * 100}%;top:${((DMG.line + DMG.iconSize / 2 + 6) / DMG.height) * 100}%;width:${(180 / DMG.width) * 100}%">${text}</div>`

writeFileSync(
  path.join(out, 'index.html'),
  `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Crew installer</title>
<style>
  :root { color-scheme: dark; --ratio: ${DMG.width} / ${DMG.height}; --glide: ${ARROW.glide}s; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 54px 40px 80px; background: #141414; color: #fff;
    font: 14px ui-sans-serif, system-ui, -apple-system, "SF Pro Text", sans-serif;
    display: flex; flex-direction: column; align-items: center;
  }
  h1 { font-size: 16px; font-weight: 500; margin: 0 0 10px; }
  p { margin: 0; color: #707070; font-size: 13px; max-width: 580px; text-align: center; line-height: 1.55; }
  .window {
    position: relative; width: min(920px, 100%);
    border-radius: 13px; overflow: hidden; margin-top: 32px;
    box-shadow: 0 44px 100px rgba(0,0,0,.62), 0 0 0 1px rgba(255,255,255,.09);
  }
  .bar {
    position: absolute; inset: 0 0 auto 0; height: 40px; z-index: 4;
    background: rgba(30,30,32,.84); backdrop-filter: blur(24px) saturate(170%);
    border-bottom: 1px solid rgba(255,255,255,.06);
    display: flex; align-items: center; gap: 8px; padding: 0 15px;
    font-size: 13px; color: rgba(255,255,255,.6);
  }
  .light { width: 11px; height: 11px; border-radius: 50%; flex: 0 0 auto; }
  .bar b { font-weight: 500; margin-left: 10px; }
  .pane { position: relative; margin-top: 40px; aspect-ratio: var(--ratio); overflow: hidden; }
  .pane canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .overlay { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 2; }
  .icon { position: absolute; z-index: 3; }
  .name { position: absolute; z-index: 3; text-align: center; font-size: 12px; color: ${LABEL}; }

  .shaft { stroke-dasharray: ${ARROW.to - ARROW.from}; animation: draw var(--glide) cubic-bezier(.5,0,.2,1) infinite; }
  .head { animation: tip var(--glide) cubic-bezier(.5,0,.2,1) infinite; }

  @keyframes draw {
    0%   { stroke-dashoffset: ${ARROW.to - ARROW.from} }
    46%  { stroke-dashoffset: 0 }
    82%  { stroke-dashoffset: 0; opacity: 1 }
    100% { stroke-dashoffset: 0; opacity: 0 }
  }
  @keyframes tip {
    0%, 12%  { opacity: 0; transform: translateX(-${ARROW.to - ARROW.from}px) }
    46%      { opacity: 1; transform: translateX(0) }
    82%      { opacity: 1; transform: translateX(0) }
    100%     { opacity: 0; transform: translateX(0) }
  }

  .sheet { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; width: min(920px, 100%); margin-top: 40px; }
  .sheet figure { margin: 0 }
  .sheet canvas { position: relative; width: 100%; aspect-ratio: var(--ratio); border-radius: 9px; }
  .sheet figcaption { margin-top: 7px; font: 11px "SF Mono", Menlo, ui-monospace, monospace; color: #707070 }
</style>
</head>
<body>
  <h1>Crew installer</h1>
  <p>Finder paints one still image behind a disk image, so what ships is a single frame of this. The row underneath is the same mesh at other moments.</p>
  <div class="window">
    <div class="bar">
      <span class="light" style="background:#ff5f57"></span>
      <span class="light" style="background:#febc2e"></span>
      <span class="light" style="background:#28c840"></span>
      <b>Crew</b>
    </div>
    <div class="pane">
      <canvas id="live"></canvas>
      <svg class="overlay" viewBox="0 0 ${DMG.width} ${DMG.height}" xmlns="http://www.w3.org/2000/svg">
        ${DMG_WASH}
        <defs>
${dmgDefs()}
        </defs>
        ${dmgArrow().replace('<line ', '<line class="shaft" ').replace('<path ', '<path class="head" ')}
        
      ${HEADLINE}
      </svg>
      ${icon(icons.app, DMG.app)}
      ${icon(icons.applications, DMG.applications)}
      ${label('Crew', DMG.app)}
      ${label('Applications', DMG.applications)}
    </div>
  </div>
  <div class="sheet" id="sheet"></div>
<script>${mesh}</script>
<script>
  const fit = canvas => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(canvas.clientWidth * dpr)
    canvas.height = Math.round(canvas.clientHeight * dpr)
  }
  const live = document.getElementById('live')
  fit(live)
  window.CrewMesh.run(live, ${DMG.at})
  window.addEventListener('resize', () => fit(live))

  const sheet = document.getElementById('sheet')
  for (const at of [${[4.2, 27.4, 51, 78.5, 104, 133, 159, 188].join(', ')}]) {
    const figure = document.createElement('figure')
    const canvas = document.createElement('canvas')
    figure.appendChild(canvas)
    const caption = document.createElement('figcaption')
    caption.textContent = 'at ' + at.toFixed(1) + 's'
    figure.appendChild(caption)
    sheet.appendChild(figure)
    fit(canvas)
    window.CrewMesh.frame(canvas, at)
  }
</script>
</body>
</html>
`
)

console.log(path.join(out, 'index.html'))
