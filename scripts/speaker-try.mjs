import { writeFile } from 'node:fs/promises'

const CONE =
  'M4 9.5h3.25L12.5 5.25a.75.75 0 0 1 1.25.6v12.3a.75.75 0 0 1-1.25.6L7.25 14.5H4a1.25 1.25 0 0 1-1.25-1.25v-2.5A1.25 1.25 0 0 1 4 9.5Z'
const WAVE_IN = 'M17 9.5a3.5 3.5 0 0 1 0 5'
const WAVE_OUT = 'M19.5 6.75a7.25 7.25 0 0 1 0 10.5'
const SLASH = 'm3.9 3.9 16.2 16.2'

const ON = [CONE, WAVE_IN, WAVE_OUT]

const TRIES = [
  ['on', ON],
  ['now: cone + X 6', [CONE, 'm15.75 9 6 6M21.75 9l-6 6']],
  ['cone + waves + slash', [...ON, SLASH]],
  ['cone + waves + slash, waves cut', [CONE, 'M17.75 10.4a3.5 3.5 0 0 1 .25 3.6', 'M20.6 8.15a7.25 7.25 0 0 1 .3 8.35', SLASH]],
  ['was: cone + slash', [CONE, SLASH]],
  ['cone + X 5 gap 3', [CONE, 'm16.75 9.5 5 5M21.75 9.5l-5 5']]
]

const svg = paths =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths
    .map(d => `<path d="${d}"/>`)
    .join('')}</svg>`

const card = ([name, paths]) => `
  <div class="card">
    <div class="row"><span class="s16">${svg(paths)}</span><span class="s16 mid">${svg(paths)}</span><span class="s16 big">${svg(paths)}</span></div>
    <div class="menu">${svg(paths)}<em>Mute sounds</em></div>
    <span class="name">${name}</span>
  </div>`

await writeFile(
  new URL('../speaker-try.html', import.meta.url),
  `<!doctype html><meta charset="utf8"><style>
    body{margin:0;padding:20px;background:#0c0d0e;color:#f5f5f5;font:11px -apple-system,system-ui,sans-serif}
    .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
    .card{background:#151719;border-radius:14px;padding:14px;display:flex;flex-direction:column;align-items:center;gap:12px}
    .row{display:flex;align-items:center;gap:26px;height:130px}
    .s16{display:inline-flex;width:16px;height:16px}
    .mid{zoom:3}
    .big{zoom:8}
    .menu{display:flex;align-items:center;gap:9px;font-size:13px;color:#c8ccd0;background:#1d2023;padding:7px 12px;border-radius:9px;width:150px}
    .menu svg{width:16px;height:16px;flex:none}
    .menu em{font-style:normal}
    .name{color:#8b8f94;font-size:10px}
    svg{width:100%;height:100%}
  </style><div class="grid">${TRIES.map(card).join('')}</div>`
)
