import { spawn } from 'node:child_process'
import { mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const PILL =
  'group relative flex items-center gap-1.5 h-9 pl-3 pr-1.5 rounded-full text-sm font-medium max-w-[180px] shrink-0'

const PILLS = Array.from(
  { length: 8 },
  (_, i) =>
    `<button data-pill="${i}" class="${PILL} ${i === 7 ? 'bg-ink-800 text-fg' : 'text-fg-muted'}"><span class="w-4 h-4 shrink-0 rounded-sm bg-fg/20"></span><span class="truncate">Tab ${i + 1}</span><span class="w-5 h-5 shrink-0 rounded-full"></span></button>`
).join('')

const ICON = 'w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-fg-muted'

const CRUMBS = '<div class="flex-1 min-w-0 h-9 px-3 rounded-full bg-ink-800 flex items-center text-sm truncate">src/renderer/src/components/BrowserPanel.tsx</div>'

const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><script type="module" src="./probe.js"></script></head>
<body>
  <div id="root">
    <div id="approw" class="h-full flex relative">
      <div id="rail" class="shrink-0 overflow-hidden transition-[width]" style="width:0px">
        <div class="h-full" style="width:260px"></div>
      </div>
      <div id="maincol" class="flex-1 min-w-0 relative isolate bg-ink-900">
        <main class="absolute inset-0"></main>
      </div>
      <div id="outer" class="relative shrink-0 overflow-hidden bg-ink-900 border-l border-ink-700 transition-[width] duration-200" style="width:380px">
        <div id="inner" class="absolute inset-y-0 left-0 h-full" style="width:380px">
          <div id="col" class="h-full flex flex-col">
            <header id="head" class="app-drag h-[70px] px-4 flex items-center gap-1.5 shrink-0">
              <div id="row" class="app-no-drag flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto overflow-y-hidden no-scrollbar">${PILLS}</div>
              <span class="app-no-drag shrink-0 flex">
                <button class="${ICON}"></button>
                <button class="${ICON}"></button>
              </span>
            </header>
            <div id="toolbar" class="app-no-drag px-4 pb-3 flex items-center gap-1 shrink-0" style="display:none">
              <button class="${ICON}"></button>
              <button class="${ICON}"></button>
              <button class="${ICON}"></button>
              ${CRUMBS}
              <button class="${ICON}"></button>
            </div>
            <div id="content" class="app-no-drag flex-1 min-h-0 relative border-t border-ink-700"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body></html>`

const MAIN = `const { app, BrowserWindow } = require('electron')
const path = require('node:path')
app.disableHardwareAcceleration()

const wait = ms => new Promise(r => setTimeout(r, ms))

// Every box between the last pill and the document, plus the two boxes beside
// the chain that the report asks about.
const LEVELS = \`[
  ['row', document.getElementById('row')],
  ['header', document.getElementById('head')],
  ['panel column', document.getElementById('col')],
  ['SidePanel inner', document.getElementById('inner')],
  ['SidePanel outer', document.getElementById('outer')],
  ['flex-1 column', document.getElementById('maincol')],
  ['h-full flex row', document.getElementById('approw')],
  ['#root', document.getElementById('root')],
  ['body', document.body],
  ['scrollingElement', document.scrollingElement],
]\`

const READ = \`(() => {
  const out = []
  for (const [name, el] of \${LEVELS}) {
    if (!el) continue
    const style = getComputedStyle(el)
    out.push({
      name,
      scrollTop: el.scrollTop,
      scrollLeft: el.scrollLeft,
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      overflowX: style.overflowX,
      overflowY: style.overflowY,
    })
  }
  const head = document.getElementById('head').getBoundingClientRect()
  return { levels: out, header: { top: head.top, bottom: head.bottom, height: head.height }, windowScrollY: window.scrollY, windowScrollX: window.scrollX }
})()\`

const RESET = \`(() => {
  for (const [, el] of \${LEVELS}) { if (el) { el.scrollTop = 0; el.scrollLeft = 0 } }
  window.scrollTo(0, 0)
})()\`

const LAST = \`document.querySelector('[data-pill="7"]')\`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1440, height: 900, show: true })
  const js = code => win.webContents.executeJavaScript(code)
  const cases = {}
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(700)

    const drawn = await js(\`document.getElementById('root').innerHTML.length\`)

    // A. settled width, no file toolbar, instant scrollIntoView.
    await js(RESET)
    const aBefore = await js(READ)
    await js(\`\${LAST}.scrollIntoView({ block: 'nearest', inline: 'nearest' })\`)
    cases.A = { before: aBefore, after: await js(READ) }

    // B. the same with the file toolbar row standing, so the column is taller.
    await js(\`document.getElementById('toolbar').style.display = 'flex'\`)
    await wait(60)
    await js(RESET)
    const bBefore = await js(READ)
    await js(\`\${LAST}.scrollIntoView({ block: 'nearest', inline: 'nearest' })\`)
    cases.B = { before: bBefore, after: await js(READ) }
    await js(\`document.getElementById('toolbar').style.display = 'none'\`)
    await wait(60)

    // C. mid animation: the outer box far narrower than the inner one it holds.
    await js(\`(() => {
      const outer = document.getElementById('outer')
      outer.classList.remove('transition-[width]', 'duration-200')
      outer.style.transition = 'none'
      outer.style.width = '40px'
      document.getElementById('inner').style.width = '380px'
    })()\`)
    await wait(80)
    await js(RESET)
    const cBefore = await js(READ)
    await js(\`\${LAST}.scrollIntoView({ block: 'nearest', inline: 'nearest' })\`)
    const cAfter = await js(READ)
    await wait(400)
    const cRested = await js(READ)
    // and then let the panel finish opening, the way the real animation does.
    await js(\`document.getElementById('outer').style.width = '380px'\`)
    await wait(300)
    cases.C = { before: cBefore, after: cAfter, rested: cRested, opened: await js(READ) }
    await js(\`(() => {
      const outer = document.getElementById('outer')
      outer.style.transition = ''
      outer.classList.add('transition-[width]', 'duration-200')
    })()\`)
    await wait(80)

    // D. real vertical overflow on #root: a tall sibling beside the app row, so
    // #root's own content really is taller than #root.
    await js(\`(() => {
      const tall = document.createElement('div')
      tall.id = 'tall'
      tall.style.cssText = 'height:400px'
      document.getElementById('root').appendChild(tall)
    })()\`)
    await wait(80)
    await js(RESET)
    const dBefore = await js(READ)
    await js(\`\${LAST}.scrollIntoView({ block: 'nearest', inline: 'nearest' })\`)
    const dAfter = await js(READ)
    // Can it be moved by hand at all, now that it has somewhere to go?
    await js(\`document.getElementById('root').scrollTop = 200\`)
    const dForced = await js(\`document.getElementById('root').scrollTop\`)
    // And the decisive one: with it already scrolled down, does scrollIntoView
    // on the pill drag it back? That is the only way block:'nearest' ever moves
    // a box, since a pill already in view is left alone.
    const dScrolled = await js(READ)
    await js(\`\${LAST}.scrollIntoView({ block: 'nearest', inline: 'nearest' })\`)
    cases.D = {
      before: dBefore,
      after: dAfter,
      forcedRootScrollTop: dForced,
      scrolled: dScrolled,
      pulledBack: await js(READ),
    }
    await js(\`document.getElementById('tall').remove()\`)
    await wait(80)

    // F. the same question of the one box between the pill and #root that really
    // clips: SidePanel outer. Give the column inside it more height than it has,
    // scroll it down by hand, and see what scrollIntoView does about it.
    await js(\`(() => {
      document.getElementById('col').style.height = '1200px'
    })()\`)
    await wait(80)
    await js(RESET)
    const fBefore = await js(READ)
    await js(\`\${LAST}.scrollIntoView({ block: 'nearest', inline: 'nearest' })\`)
    const fAfter = await js(READ)
    await js(\`document.getElementById('outer').scrollTop = 120\`)
    const fScrolled = await js(READ)
    await js(\`\${LAST}.scrollIntoView({ block: 'nearest', inline: 'nearest' })\`)
    const fPulled = await js(READ)
    await wait(400)
    cases.F = { before: fBefore, after: fAfter, scrolled: fScrolled, pulledBack: fPulled, rested: await js(READ) }
    await js(\`document.getElementById('col').style.height = ''\`)
    await wait(80)

    // E. the real call, which is behavior: 'smooth'.
    await js(RESET)
    const eBefore = await js(READ)
    await js(\`\${LAST}.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })\`)
    await wait(500)
    cases.E = { before: eBefore, after: await js(READ) }

    // G. is F reachable at all? Sweep real window heights, with and without the
    // file toolbar, and read whether the outer ever has anywhere to scroll to.
    const sweep = []
    for (const h of [900, 899, 901, 875, 768, 700, 601, 500, 401, 300, 200, 160, 140]) {
      for (const toolbar of [false, true]) {
        win.setSize(1440, h)
        await wait(90)
        await js(\`document.getElementById('toolbar').style.display = '\${toolbar ? 'flex' : 'none'}'\`)
        await wait(90)
        await js(RESET)
        await js(\`\${LAST}.scrollIntoView({ block: 'nearest', inline: 'nearest' })\`)
        sweep.push(
          await js(\`(() => {
            const outer = document.getElementById('outer')
            const root = document.getElementById('root')
            const head = document.getElementById('head').getBoundingClientRect()
            return {
              asked: \${h}, toolbar: \${toolbar},
              outerClientH: outer.clientHeight, outerScrollH: outer.scrollHeight,
              outerTop: outer.scrollTop, outerLeft: outer.scrollLeft,
              rootClientH: root.clientHeight, rootScrollH: root.scrollHeight, rootTop: root.scrollTop,
              headerTop: head.top,
            }
          })()\`)
        )
      }
    }
    await js(\`document.getElementById('toolbar').style.display = 'none'\`)
    win.setSize(1440, 900)

    console.log('SEEN ' + JSON.stringify({ drawn, cases, sweep }))
  } catch (e) {
    console.log('SEEN ' + JSON.stringify({ failed: String(e && e.message) }))
  }
  app.exit(0)
})`

async function stage() {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-panel-scroll-')))
  await writeFile(path.join(dir, 'index.html'), PAGE)
  await writeFile(
    path.join(dir, 'probe.css'),
    `@import "${path.join(root, 'src/renderer/src/styles.css')}";\n@source "${path.join(root, 'src/renderer/src')}";\n@source "${path.join(dir, 'index.html')}";\n`
  )
  await writeFile(path.join(dir, 'probe.js'), `import './probe.css'\n`)
  await writeFile(path.join(dir, 'main.cjs'), MAIN)
  return dir
}

async function compile(dir) {
  const { build } = await import('vite')
  const tailwind = (await import('@tailwindcss/vite')).default
  await build({
    root: dir,
    base: './',
    logLevel: 'silent',
    plugins: [tailwind()],
    build: { outDir: path.join(dir, 'dist'), emptyOutDir: true },
  })
  const assets = path.join(dir, 'dist/assets')
  const files = await readdir(assets)
  const sheet = files.find(name => name.endsWith('.css'))
  if (!sheet) throw new Error('the probe came out with no stylesheet')
  const css = await readFile(path.join(assets, sheet), 'utf8')
  return {
    rootRule: css.includes('#root{') || /#root\s*\{/.test(css),
    hidden: css.includes('overflow:hidden'),
    noScrollbar: css.includes('scrollbar-width:none'),
    header: css.includes('height:70px'),
  }
}

function run(dir) {
  return new Promise((resolve, reject) => {
    const child = spawn(electron, [path.join(dir, 'main.cjs')], { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', chunk => (out += chunk))
    child.stderr.on('data', () => {})
    child.on('exit', () => {
      const line = out.split('\n').find(row => row.startsWith('SEEN '))
      if (!line) return reject(new Error('the window said nothing back'))
      resolve(JSON.parse(line.slice(5)))
    })
    child.on('error', reject)
  })
}

const SAYS = {
  A: 'settled 380 wide, no file toolbar, scrollIntoView instant',
  B: 'the same with the file toolbar row standing (column ~48px taller)',
  C: 'mid animation: outer 40 wide holding an inner 380 wide',
  D: '#root given real vertical overflow (a 400px sibling inside it)',
  E: 'the same as A but behavior: smooth, read 500ms later',
  F: 'SidePanel outer given real vertical overflow (the column forced to 1200)',
}

function table(before, after) {
  const rows = []
  const width = Math.max(...before.levels.map(l => l.name.length))
  rows.push(
    '  ' +
      'box'.padEnd(width) +
      '  scrollTop        scrollLeft       client/scroll W    client/scroll H    overflow'
  )
  for (let i = 0; i < before.levels.length; i++) {
    const b = before.levels[i]
    const a = after.levels[i]
    const moved = b.scrollTop !== a.scrollTop || b.scrollLeft !== a.scrollLeft
    rows.push(
      '  ' +
        b.name.padEnd(width) +
        '  ' +
        `${b.scrollTop} -> ${a.scrollTop}`.padEnd(17) +
        `${b.scrollLeft} -> ${a.scrollLeft}`.padEnd(17) +
        `${b.clientWidth}/${b.scrollWidth}`.padEnd(19) +
        `${b.clientHeight}/${b.scrollHeight}`.padEnd(19) +
        `${b.overflowX}/${b.overflowY}` +
        (moved ? '   <== MOVED' : '')
    )
  }
  rows.push(
    '  ' +
      'window'.padEnd(width) +
      '  ' +
      `${before.windowScrollY} -> ${after.windowScrollY}`.padEnd(17) +
      `${before.windowScrollX} -> ${after.windowScrollX}`.padEnd(17)
  )
  rows.push(
    `  header rect: top ${before.header.top} -> ${after.header.top}, bottom ${before.header.bottom} -> ${after.header.bottom}, height ${before.header.height} -> ${after.header.height}`
  )
  const movers = before.levels
    .filter((b, i) => b.scrollTop !== after.levels[i].scrollTop || b.scrollLeft !== after.levels[i].scrollLeft)
    .map(b => b.name)
  rows.push('  moved: ' + (movers.length ? movers.join(', ') : 'nothing'))
  return rows.join('\n')
}

const dir = await stage()
try {
  const css = await compile(dir)
  console.log(
    `stylesheet: #root rule ${css.rootRule ? 'present' : 'MISSING'}, overflow:hidden ${css.hidden ? 'present' : 'MISSING'}, scrollbar-width:none ${css.noScrollbar ? 'present' : 'MISSING'}, h-[70px] ${css.header ? 'present' : 'MISSING'}`
  )
  const seen = await run(dir)
  if (seen.failed) throw new Error(seen.failed)
  if (!seen.drawn) throw new Error('the page came up empty, so nothing was really tested')

  for (const [name, one] of Object.entries(seen.cases)) {
    console.log(`\n=== ${name}: ${SAYS[name]} ===`)
    console.log(table(one.before, one.after))
    if (one.forcedRootScrollTop !== undefined) {
      console.log(`\n  #root.scrollTop written by hand to 200, read back: ${one.forcedRootScrollTop}`)
    }
    if (one.scrolled && one.pulledBack) {
      console.log('\n  scrolled down by hand, then scrollIntoView on the last pill again:')
      console.log(table(one.scrolled, one.pulledBack))
    }
    if (one.rested) {
      console.log('\n  400ms later, on its own:')
      console.log(table(one.pulledBack || one.after, one.rested))
    }
    if (one.opened) {
      console.log('\n  and after the outer box finishes opening to 380:')
      console.log(table(one.rested, one.opened))
    }
  }
} finally {
  await rm(dir, { recursive: true, force: true })
}
