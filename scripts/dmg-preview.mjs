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
const LABEL = '#030303'

const geometry = { bite: 28 / 130, step: 186 / 130 }

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

const shots = (await shootCovers(DMG_COVERS)).filter(shot => shot.png)
const loop = shots.length * HOLD
const discs = dmgDiscs(geometry)

const chrome = (prefix, animated) => {
  const { masks, drawn } = dmgOverlay(geometry, prefix)
  const marks = animated
    ? discs
        .map(
          (disc, index) =>
            `  <circle class="disc" style="--rest:${disc.o};--lag:${(((index / discs.length) * RUN - RUN) * 0.5).toFixed(2)}s" cx="${disc.x}" cy="${disc.y}" r="${disc.r}" fill="#141414"${disc.cut ? ` mask="url(#${prefix}-${index})"` : ''} />`
        )
        .join('\n')
    : drawn
  return `<svg class="overlay" viewBox="0 0 ${DMG.width} ${DMG.height}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
  <defs>
${DMG_DEFS.replaceAll('id="', `id="${prefix}-`)}
${masks}
  </defs>
${DMG_WASH.replaceAll('url(#', `url(#${prefix}-`)}
${marks}
  ${HEADLINE}
${DMG_GRAIN.replaceAll('url(#', `url(#${prefix}-`)}
</svg>`
}

const label = (text, cx, size) =>
  `<div class="name" style="left:${((cx - 90) / DMG.width) * 100}%;top:${((DMG.line + DMG.iconSize / 2 + 6) / DMG.height) * 100}%;width:${(180 / DMG.width) * 100}%;font-size:${size}px">${text}</div>`

const icon = (data, cx, box) =>
  `<img class="icon" style="left:${((cx - DMG.iconSize / 2) / DMG.width) * 100}%;top:${((DMG.line - DMG.iconSize / 2) / DMG.height) * 100}%;width:${(DMG.iconSize / DMG.width) * 100}%" src="data:image/png;base64,${data}" alt="">`

const stage = shots
  .map(
    (shot, index) =>
      `      <img class="ground" style="--lag:${(index * HOLD).toFixed(2)}s" src="${shot.png}" alt="">`
  )
  .join('\n')

const names = shots
  .map(
    (shot, index) =>
      `        <span class="seed" style="--lag:${(index * HOLD).toFixed(2)}s">${shot.id}</span>`
  )
  .join('\n')

const sheet = shots
  .map(
    (shot, index) => `    <figure>
      <div class="tile">
        <img class="still" src="${shot.png}" alt="">
        ${chrome(`t${index}`, false)}
        ${icon(icons.app, DMG.app)}
        ${icon(icons.applications, DMG.applications)}
        ${label('Crew', DMG.app, 7)}
        ${label('Applications', DMG.applications, 7)}
      </div>
      <figcaption>${shot.id}</figcaption>
    </figure>`
  )
  .join('\n')

writeFileSync(
  path.join(out, 'index.html'),
  `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Crew installer</title>
<style>
  :root { color-scheme: dark; --ratio: ${DMG.width} / ${DMG.height}; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 52px 40px 76px; background: #141414; color: #fff;
    font: 14px ui-sans-serif, system-ui, -apple-system, "SF Pro Text", sans-serif;
    display: flex; flex-direction: column; align-items: center;
  }
  h1 { font-size: 16px; font-weight: 500; margin: 0 0 10px; }
  p { margin: 0; color: #707070; font-size: 13px; max-width: 560px; text-align: center; line-height: 1.55; }
  .window {
    position: relative; width: min(900px, 100%); aspect-ratio: var(--ratio);
    border-radius: 13px; overflow: hidden; margin-top: 30px;
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
  .pane { position: absolute; inset: 40px 0 0 0; overflow: hidden; }
  .ground {
    position: absolute; left: 50%; top: 50%; width: 132%; height: 132%;
    object-fit: cover; transform-origin: 50% 50%; opacity: 0; will-change: opacity, transform;
    animation: show ${loop}s linear infinite, breathe 23s ease-in-out infinite alternate;
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
    from { transform: translate(-50%, -50%) scale(1) rotate(-1.1deg) }
    to   { transform: translate(-50%, -50%) scale(1.085) rotate(1.1deg) }
  }
  .overlay { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 2; }
  .disc { fill-opacity: var(--rest); animation: run ${RUN}s ease-in-out infinite; animation-delay: var(--lag); }
  @keyframes run {
    0%, 58%, 100% { fill-opacity: var(--rest) }
    24% { fill-opacity: calc(var(--rest) + .2) }
  }
  .icon { position: absolute; z-index: 3; }
  .name {
    position: absolute; z-index: 3; text-align: center; font-size: 12px; color: ${LABEL};
  }
  .seeds { position: absolute; z-index: 5; left: 14px; bottom: 11px; height: 15px; }
  .seed {
    position: absolute; left: 0; bottom: 0; white-space: nowrap; opacity: 0;
    font: 11px "SF Mono", Menlo, ui-monospace, monospace; color: rgba(20,20,20,.5);
    animation: show ${loop}s linear infinite; animation-delay: var(--lag);
  }
  .sheet {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px 16px;
    width: min(900px, 100%); margin-top: 44px;
  }
  .sheet figure { margin: 0; }
  .tile {
    position: relative; aspect-ratio: var(--ratio); border-radius: 9px; overflow: hidden;
    box-shadow: 0 0 0 1px rgba(255,255,255,.07);
  }
  .tile .still { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .sheet figcaption {
    margin-top: 8px; font: 11px "SF Mono", Menlo, ui-monospace, monospace; color: #707070;
  }
</style>
</head>
<body>
  <h1>Crew installer</h1>
  <p>Finder paints one still image behind a disk image, so a single frame is what ships. This is the set it is picked from, and the labels are the near-black Finder really draws.</p>
  <div class="window">
    <div class="bar">
      <span class="light" style="background:#ff5f57"></span>
      <span class="light" style="background:#febc2e"></span>
      <span class="light" style="background:#28c840"></span>
      <b>Crew</b>
    </div>
    <div class="pane">
${stage}
      ${chrome('live', true)}
      ${icon(icons.app, DMG.app)}
      ${icon(icons.applications, DMG.applications)}
      ${label('Crew', DMG.app, 12)}
      ${label('Applications', DMG.applications, 12)}
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

console.log(path.join(out, 'index.html'))
console.log(`${shots.length} covers, ${loop.toFixed(1)}s loop`)
