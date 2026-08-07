import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import electron from 'electron'

// The one part of reading a page no suite can stand in for. A preview is drawn
// from the words in hand, so it is stood up out of the folder the page really
// lives in, and everything the page points at beside itself is a file the
// browser may quietly refuse to fetch. Refused, the page still draws: it comes
// out unstyled, with a hole where every picture is, and every suite is green. So
// this runs the real code in a real window and reads what actually arrived.
//
// A page too big to hold whole is the third of them, and it is the one that was
// really broken: handed the head of a file, the browser draws the chrome down to
// the cut and the script that was severed never runs, which is a page that looks
// like it loaded and does nothing.

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const SITE = `<!doctype html>
<html>
  <head>
    <title>Signup</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <h1>Sign up</h1>
    <img id="shot" src="art/shot.gif" alt="a shot" />
    <script src="mark.js"></script>
  </body>
</html>
`

const STYLE = `h1 { color: rgb(0, 128, 0) }`
const MARK = `document.body.dataset.ran = 'yes'`
const GIF = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

const HOST = `<!doctype html><html><body style="margin:0">
<webview id="view" style="position:absolute;inset:0;width:100%;height:100%"></webview>
<script>
const { ipcRenderer } = require('electron')
const view = document.getElementById('view')

window.show = url => new Promise(resolve => {
  view.addEventListener('did-finish-load', () => resolve(true), { once: true })
  view.addEventListener('did-fail-load', event => resolve({ failed: event.errorDescription }), { once: true })
  view.src = url
})

window.report = () => view.executeJavaScript(\`({
  heading: document.querySelector('h1') ? document.querySelector('h1').textContent : null,
  color: document.querySelector('h1') ? getComputedStyle(document.querySelector('h1')).color : null,
  picture: document.getElementById('shot') ? document.getElementById('shot').naturalWidth : 0,
  ran: document.body.dataset.ran || 'no',
  base: document.baseURI
})\`)
</script></body></html>`

const MAIN = `import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { Previews } from './preview.mjs'

const site = process.env.CHECK_SITE
const words = process.env.CHECK_WORDS

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false, webviewTag: true }
  })
  await window.loadFile(path.join(import.meta.dirname, 'host.html'))
  const previews = new Previews()
  const url = await previews.show('one', site, words === 'HELD' ? null : words)
  if (!url) throw new Error('the page was never stood up')
  const loaded = await window.webContents.executeJavaScript('window.show(' + JSON.stringify(url) + ')')
  if (loaded !== true) throw new Error('the page never loaded: ' + JSON.stringify(loaded))
  const seen = await window.webContents.executeJavaScript('window.report()')
  console.log('CHECK ' + JSON.stringify({ ...seen, url }))
  app.exit(0)
}).catch(error => {
  console.log('CHECK ' + JSON.stringify({ failed: String(error && error.message) }))
  app.exit(1)
})
`

const EDITED = SITE.replace('<h1>Sign up</h1>', '<h1>Written just now</h1>')

// A page somebody attached has no file behind it, so there is no folder to hand
// it and everything it needs is carried inside it. It is the same words stood up
// the same way, and the whole question is whether one with nothing to reach for
// still draws.
const ATTACHED = `<!doctype html>
<html>
  <head>
    <title>Hello everyone</title>
    <style>h1 { color: rgb(0, 128, 0) }</style>
  </head>
  <body>
    <h1>Written just now</h1>
    <img id="shot" src="data:image/gif;base64,${GIF}" alt="a shot" />
    <script>document.body.dataset.ran = 'yes'</script>
  </body>
</html>
`

async function stage() {
  const dir = await mkdtemp(path.join(tmpdir(), 'crew-preview-'))
  const site = path.join(dir, 'site')
  await mkdir(path.join(site, 'art'), { recursive: true })
  await writeFile(path.join(site, 'index.html'), SITE)
  await writeFile(path.join(site, 'style.css'), STYLE)
  await writeFile(path.join(site, 'mark.js'), MARK)
  await writeFile(path.join(site, 'art/shot.gif'), Buffer.from(GIF, 'base64'))
  await build({
    entryPoints: [path.join(root, 'src/main/preview.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    packages: 'external',
    outfile: path.join(dir, 'preview.mjs'),
    logLevel: 'error'
  })
  await writeFile(path.join(dir, 'host.html'), HOST)
  await writeFile(path.join(dir, 'main.mjs'), MAIN)
  return { dir, page: path.join(site, 'index.html') }
}

function run(dir, page, words) {
  return new Promise((resolve, reject) => {
    const child = spawn(electron, [path.join(dir, 'main.mjs')], {
      env: { ...process.env, ELECTRON_ENABLE_LOGGING: '0', CHECK_SITE: page, CHECK_WORDS: words },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let out = ''
    child.stdout.on('data', chunk => (out += chunk))
    child.stderr.on('data', () => {})
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('the check never finished'))
    }, 60_000)
    child.on('exit', () => {
      clearTimeout(timer)
      const line = out.split('\n').find(text => text.startsWith('CHECK '))
      if (!line) return reject(new Error('the check said nothing'))
      resolve(JSON.parse(line.slice(6)))
    })
  })
}

function judge(seen, beside) {
  if (seen.failed) return [`the page fell over: ${seen.failed}`]
  const problems = []
  if (seen.heading !== 'Written just now') problems.push(`the page reads "${seen.heading}", not the words in hand`)
  if (seen.color !== 'rgb(0, 128, 0)') problems.push(`the style never arrived, the heading is ${seen.color}`)
  if (seen.picture !== 1) problems.push('the picture never arrived')
  if (seen.ran !== 'yes') problems.push('the script never ran')
  if (beside && seen.base === seen.url) problems.push('the page was never handed the folder it lives in')
  if (!beside && seen.base !== seen.url) problems.push(`a page with no folder was handed one: ${seen.base}`)
  return problems
}

function say(what, seen, problems) {
  console.log(problems.length ? `${what} is broken:\n  ${problems.join('\n  ')}` : `${what} works.`)
  console.log(`  words: ${seen.heading}`)
  console.log(`  heading color: ${seen.color}`)
  console.log(`  picture: ${seen.picture}px wide`)
  console.log(`  script: ${seen.ran === 'yes' ? 'ran' : 'never ran'}`)
  console.log(`  reaching from: ${seen.base}`)
}

const { dir, page } = await stage()
try {
  const beside = await run(dir, page, EDITED)
  const problems = judge(beside, true)
  say('Reading a page in the project', beside, problems)
  const attached = await run(dir, '', ATTACHED)
  const alone = judge(attached, false)
  say('Reading a page somebody attached', attached, alone)
  if (problems.length || alone.length) process.exitCode = 1
} finally {
  await rm(dir, { recursive: true, force: true })
}
