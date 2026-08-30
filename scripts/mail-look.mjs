import { spawn } from 'node:child_process'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const resolve = createRequire(path.join(root, 'package.json')).resolve
const shots = path.join(tmpdir(), 'crew-mail-look')

function source() {
  const from = file => JSON.stringify(path.join(root, 'src/renderer/src', file))
  return `import React from ${JSON.stringify(resolve('react'))}
import { createRoot } from ${JSON.stringify(resolve('react-dom/client'))}
import Mail from ${from('views/Mail.tsx')}
import WindowCorner from ${from('components/WindowCorner.tsx')}
import { useMail } from ${from('state/mail.ts')}
import { useSidebar } from ${from('state/sidebar.ts')}
import './probe.css'

const personal = {
  id: 'personal', email: 'jamel@gmail.com', displayName: 'Jamel', status: 'connected', unread: 2,
  labels: [{ id: 'travel', name: 'Travel', unread: 1 }, { id: 'receipts', name: 'Receipts', unread: 0 }]
}
const work = {
  id: 'work', email: 'jamel@crew.test', displayName: 'Jamel at Crew', status: 'connected', unread: 1, labels: []
}
const dinner = {
  id: 'dinner', accountId: 'personal', subject: 'Dinner this weekend',
  participants: [{ name: 'Ali', email: 'ali@example.com' }], preview: 'Saturday works for everyone.',
  date: '2026-08-29T12:00:00.000Z', unread: true, starred: false, hasAttachments: true,
  messageCount: 2, mailboxIds: ['inbox'], labelIds: ['travel']
}
const receipt = {
  id: 'receipt', accountId: 'personal', subject: 'Your train receipt',
  participants: [{ name: 'Coast Rail', email: 'tickets@rail.example' }], preview: 'Your ticket is attached.',
  date: '2026-08-28T16:00:00.000Z', unread: false, starred: false, hasAttachments: true,
  messageCount: 1, mailboxIds: ['inbox'], labelIds: ['receipts']
}
const release = {
  id: 'release', accountId: 'work', subject: 'Release checklist',
  participants: [{ name: 'Sam', email: 'sam@crew.test' }], preview: 'The build is ready for the last pass.',
  date: '2026-08-29T13:00:00.000Z', unread: true, starred: true, messageCount: 1,
  mailboxIds: ['inbox'], labelIds: []
}
const accounts = [personal, work]
const threads = [release, dinner, receipt]
const delayedHtml = '<body bgcolor="#fffef0"><table id="mail-sheet" width="600" style="width:600px;margin:0 auto;background:#fffef0;border:1px solid #004449;border-radius:7px"><tr><td style="padding:40px"><table role="presentation"><tr><td id="points-chip" style="border:1px solid #d7ffc2;background:#d7ffc2;padding:4px 12px;border-radius:32px">94k points</td></tr></table><table role="presentation" style="margin-top:48px"><tr><td id="benefit-cell" width="45" style="width:45px;padding:0 16px 16px 0"><img id="benefit-icon" src="https://mail-delay.test/icon.png" width="45" height="45" style="display:block;width:45px;height:45px;border:0"></td><td>Pick Premium or Elite membership and get 30 days of access on us</td></tr></table><div style="height:360px"></div></td></tr></table><p id="current-reply">No worries, keep me posted :)</p><div class="gmail_quote"><div>On Fri, Aug 28, 2026 at 12:21 PM Allison Stevenson wrote:</div><blockquote><div id="old-reply" style="height:340px">Happy Friday and hope your week has gone well.</div></blockquote></div></body>'
const full = {
  ...dinner,
  messages: [
    {
      id: 'dinner-one', threadId: 'dinner', accountId: 'personal', from: { name: 'Ali', email: 'ali@example.com' },
      to: [{ name: 'Jamel', email: 'jamel@gmail.com' }], cc: [], bcc: [], subject: dinner.subject,
      date: '2026-08-29T11:30:00.000Z', text: 'Would Saturday work? I can bring dessert.', unread: false,
      starred: false, attachments: []
    },
    {
      id: 'dinner-two', threadId: 'dinner', accountId: 'personal', from: { name: 'Jamel', email: 'jamel@gmail.com' },
      to: [{ name: 'Ali', email: 'ali@example.com' }], cc: [], bcc: [], subject: dinner.subject,
      date: '2026-08-29T12:00:00.000Z', text: 'Saturday works for everyone. I attached the menu.', unread: true,
      starred: false, html: delayedHtml, attachments: [{ id: 'menu', name: 'menu.pdf', mime: 'application/pdf', size: 18420 }]
    }
  ]
}

let scene = 'setup'
const rows = query => {
  const selected = query?.accountId ? threads.filter(thread => thread.accountId === query.accountId) : threads
  const text = query?.query?.toLowerCase()
  return text ? selected.filter(thread => (thread.subject + ' ' + thread.preview).toLowerCase().includes(text)) : selected
}
const bridge = {
  listAccounts: async () => scene === 'setup' ? [] : accounts,
  connectAccount: async input => ({ ...personal, email: input.email, displayName: input.displayName }),
  removeAccount: async () => {}, reconnectAccount: async id => accounts.find(one => one.id === id),
  updateAccount: async (id, patch) => ({ ...accounts.find(one => one.id === id), ...patch }),
  listThreads: async query => scene === 'loading' ? new Promise(() => {}) : scene === 'empty' ? [] : rows(query),
  getThread: async () => full,
  sync: async () => ({ accounts, threads }), setThreadState: async () => {},
  saveDraft: async draft => ({ id: draft.id, updatedAt: new Date().toISOString() }), discardDraft: async () => {},
  sendDraft: async () => {}, addAttachment: async (_account, _draft, file) => ({ id: 'file', name: file.name, mime: file.type, size: file.size }),
  saveAttachment: async () => {}, printThread: async () => {}, snoozeThread: async () => {},
  onChanged: () => () => {}, onOnline: () => () => {}, onConnection: () => () => {}, onUnread: () => () => {}, onNotification: () => () => {}
}
window.mail = bridge
window.crew = { openExternal: async () => true }

const state = patch => useMail.setState({
  accounts: [], threads: [], openThread: null, drafts: [], loading: false, syncing: false,
  threadLoading: false, ready: true, online: true, issue: null, ...patch
})

window.setMailScene = name => {
  scene = name
  if (name === 'setup') state({ accounts: [] })
  else if (name === 'loading') state({ accounts, threads: [], loading: true })
  else if (name === 'empty') state({ accounts, threads: [] })
  else if (name === 'reconnect') state({
    accounts: [personal, { ...work, status: 'error', problem: 'The account needs its app password.' }],
    threads, online: false, issue: 'Mail could not be refreshed.'
  })
  else state({ accounts, threads })
}

window.setMailScene('setup')
useSidebar.setState({ pinned: false, peeking: false, near: false, over: false })
createRoot(document.getElementById('root')).render(
  React.createElement('div', { className: 'h-full relative' }, React.createElement(Mail), React.createElement(WindowCorner))
)
`
}

const main = `const { app, BrowserWindow, session } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
app.disableHardwareAcceleration()
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const shots = ${JSON.stringify(shots)}

async function shoot(win, name) {
  const image = await win.capturePage()
  fs.writeFileSync(path.join(shots, name + '.png'), image.toPNG())
}

async function scene(win, name, delay = 260) {
  await win.webContents.executeJavaScript('window.setMailScene(' + JSON.stringify(name) + ')')
  await wait(delay)
  await shoot(win, name)
}

app.whenReady().then(async () => {
  fs.mkdirSync(shots, { recursive: true })
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['https://mail-delay.test/*'] }, (_details, callback) => {
    setTimeout(() => callback({ cancel: true }), 2000)
  })
  const win = new BrowserWindow({ width: 1280, height: 780, show: true, backgroundColor: '#141414' })
  const seen = {}
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(600)
    await scene(win, 'setup')
    seen.setup = await win.webContents.executeJavaScript("Boolean(document.querySelector('input[placeholder=\\"name@gmail.com\\"]'))")
    await scene(win, 'inbox')
    seen.inbox = await win.webContents.executeJavaScript("[...document.querySelectorAll('[role=button]')].filter(node => node.textContent.includes('checklist') || node.textContent.includes('Dinner')).length")
    seen.chromeClear = await win.webContents.executeJavaScript("(() => { const projects = document.querySelector('button[aria-label=\\\"Projects\\\"]'); const compose = [...document.querySelectorAll('button')].find(node => node.textContent.trim() === 'Compose'); if (!projects || !compose) return false; const corner = projects.getBoundingClientRect(); const action = compose.getBoundingClientRect(); return corner.bottom <= action.top })()")
    await win.webContents.executeJavaScript("[...document.querySelectorAll('[role=button]')].find(node => node.textContent.includes('Dinner this weekend')).click()")
    await wait(260)
    seen.thread = await win.webContents.executeJavaScript("Boolean([...document.querySelectorAll('h1')].find(node => node.textContent === 'Dinner this weekend'))")
    seen.message = await win.webContents.executeJavaScript("(() => { const frame = document.querySelector('iframe[title=\\\"Message\\\"]'); const doc = frame && frame.contentDocument; const sheet = doc && doc.querySelector('#mail-sheet'); const chip = doc && doc.querySelector('#points-chip'); const icon = doc && doc.querySelector('#benefit-icon'); if (!frame || !sheet || !chip || !icon) return null; const iconBox = icon.getBoundingClientRect(); return { height: parseFloat(frame.style.height), collapse: getComputedStyle(sheet).borderCollapse, sheetRadius: getComputedStyle(sheet).borderTopLeftRadius, chipRadius: getComputedStyle(chip).borderTopLeftRadius, iconWidth: iconBox.width, iconHeight: iconBox.height } })()")
    seen.quoteCollapsed = await win.webContents.executeJavaScript("(() => { const frame = document.querySelector('iframe[title=\\\"Message\\\"]'); const show = [...document.querySelectorAll('button')].find(node => node.textContent.trim() === 'Show earlier mail'); return Boolean(frame && show && !frame.contentDocument.querySelector('#old-reply')) })()")
    await shoot(win, 'thread')
    seen.quoteOpenHeight = await win.webContents.executeJavaScript("(() => { const show = [...document.querySelectorAll('button')].find(node => node.textContent.trim() === 'Show earlier mail'); show.click(); return true })()")
    await wait(260)
    seen.quoteOpenHeight = await win.webContents.executeJavaScript("parseFloat(document.querySelector('iframe[title=\\\"Message\\\"]').style.height)")
    await shoot(win, 'thread-quote-open')
    await win.webContents.executeJavaScript("[...document.querySelectorAll('button')].find(node => node.textContent.trim() === 'Hide earlier mail').click()")
    await wait(260)
    seen.quoteClosed = await win.webContents.executeJavaScript("(() => { const frame = document.querySelector('iframe[title=\\\"Message\\\"]'); const show = [...document.querySelectorAll('button')].find(node => node.textContent.trim() === 'Show earlier mail'); const gap = show.getBoundingClientRect().top - frame.getBoundingClientRect().bottom; return { height: parseFloat(frame.style.height), gap, hidden: !frame.contentDocument.querySelector('#old-reply') } })()")
    await shoot(win, 'thread-quote-closed')
    await win.webContents.executeJavaScript("[...document.querySelectorAll('button')].find(node => node.textContent.trim() === 'Compose').click()")
    await wait(260)
    seen.compose = await win.webContents.executeJavaScript("Boolean(document.querySelector('[aria-label=\\"Subject\\"]'))")
    seen.composeStart = await win.webContents.executeJavaScript("document.activeElement?.getAttribute('aria-label')")
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Tab' })
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Tab' })
    await wait(80)
    seen.composeTab = await win.webContents.executeJavaScript("document.activeElement?.getAttribute('aria-label')")
    await shoot(win, 'compose')
    await scene(win, 'loading', 120)
    seen.loading = await win.webContents.executeJavaScript("document.querySelectorAll('.skeleton').length")
    await scene(win, 'empty')
    seen.empty = await win.webContents.executeJavaScript("document.body.textContent.includes('Inbox is clear')")
    await scene(win, 'reconnect')
    seen.reconnect = await win.webContents.executeJavaScript("document.body.textContent.includes('Reconnect') && document.body.textContent.includes('Offline')")
  } catch (error) {
    seen.failed = String(error && error.stack)
  }
  console.log('SEEN ' + JSON.stringify(seen))
  app.exit(0)
})`

async function stage() {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-mail-look-')))
  await writeFile(
    path.join(directory, 'index.html'),
    '<!doctype html><html><head><meta charset="utf-8"><script type="module" src="/probe.tsx"></script></head><body class="mac"><div id="root"></div></body></html>'
  )
  await writeFile(path.join(directory, 'probe.tsx'), source())
  await writeFile(
    path.join(directory, 'probe.css'),
    `@import "${path.join(root, 'src/renderer/src/styles.css')}";\n@source "${path.join(root, 'src/renderer/src')}";\nhtml, body, #root { width: 100%; height: 100%; margin: 0; }\n`
  )
  await writeFile(path.join(directory, 'main.cjs'), main)
  return directory
}

async function compile(directory) {
  const { build } = await import('vite')
  const tailwind = (await import('@tailwindcss/vite')).default
  await build({
    root: directory,
    base: './',
    logLevel: 'silent',
    plugins: [tailwind()],
    build: { outDir: path.join(directory, 'dist'), emptyOutDir: true }
  })
}

function run(directory) {
  return new Promise((accept, reject) => {
    const child = spawn(electron, [path.join(directory, 'main.cjs')], { stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    let errors = ''
    child.stdout.on('data', chunk => (output += chunk))
    child.stderr.on('data', chunk => (errors += chunk))
    child.on('exit', () => {
      const line = output.split('\n').find(row => row.startsWith('SEEN '))
      if (!line) return reject(new Error(errors || 'the window said nothing back'))
      accept(JSON.parse(line.slice(5)))
    })
    child.on('error', reject)
  })
}

const directory = await stage()
try {
  await compile(directory)
  const seen = await run(directory)
  if (seen.failed) throw new Error(seen.failed)
  if (seen.composeStart !== 'To' || seen.composeTab !== 'Subject') throw new Error('the composer tabbed from ' + seen.composeStart + ' to ' + seen.composeTab)
  console.log('compose focus     ' + seen.composeStart + ' → ' + seen.composeTab)
  if (!seen.setup) throw new Error('setup did not show the Google email field')
  if (seen.inbox < 2) throw new Error(`the populated inbox showed ${seen.inbox} expected rows`)
  if (!seen.chromeClear) throw new Error('the collapsed Crew control overlapped Compose')
  if (!seen.thread) throw new Error('the conversation did not open')
  if (!seen.message || seen.message.height < 500) throw new Error(`the parsed message stayed at ${seen.message?.height ?? 0}px before its image loaded`)
  if (!seen.quoteCollapsed) throw new Error('the old reply was visible by default')
  if (seen.quoteOpenHeight < seen.message.height + 300) throw new Error(`the old reply only grew the message from ${seen.message.height}px to ${seen.quoteOpenHeight}px`)
  if (!seen.quoteClosed.hidden || Math.abs(seen.quoteClosed.height - seen.message.height) > 2) throw new Error(`the old reply closed to ${seen.quoteClosed.height}px instead of ${seen.message.height}px`)
  if (seen.quoteClosed.gap < 14 || seen.quoteClosed.gap > 18) throw new Error(`the closed reply button stood ${seen.quoteClosed.gap}px from the message`)
  if (seen.message.collapse !== 'separate') throw new Error(`the sender table collapsed as ${seen.message.collapse}`)
  if (seen.message.sheetRadius !== '7px' || seen.message.chipRadius !== '32px') throw new Error(`the sender curves became ${seen.message.sheetRadius} and ${seen.message.chipRadius}`)
  if (seen.message.iconWidth !== 45 || seen.message.iconHeight !== 45) throw new Error(`the sender artwork became ${seen.message.iconWidth} by ${seen.message.iconHeight}`)
  if (!seen.compose) throw new Error('the composer did not open')
  if (seen.loading < 1) throw new Error('the loading state had no skeletons')
  if (!seen.empty) throw new Error('the empty inbox did not say it was clear')
  if (!seen.reconnect) throw new Error('the reconnect state did not show its account and connection status')
  console.log(`setup            ${seen.setup ? 'yes' : 'no'}`)
  console.log(`inbox rows        ${seen.inbox}`)
  console.log(`collapsed chrome  ${seen.chromeClear ? 'clear' : 'overlapping'}`)
  console.log(`thread            ${seen.thread ? 'yes' : 'no'}`)
  console.log(`early body        ${seen.message.height}px`)
  console.log(`quoted reply      ${seen.message.height}px → ${seen.quoteOpenHeight}px → ${seen.quoteClosed.height}px`)
  console.log(`reply button gap  ${seen.quoteClosed.gap}px`)
  console.log(`sender curves     ${seen.message.sheetRadius}, ${seen.message.chipRadius}`)
  console.log(`sender artwork    ${seen.message.iconWidth} x ${seen.message.iconHeight}`)
  console.log(`compose           ${seen.compose ? 'yes' : 'no'}`)
  console.log(`loading skeletons ${seen.loading}`)
  console.log(`empty             ${seen.empty ? 'yes' : 'no'}`)
  console.log(`reconnect         ${seen.reconnect ? 'yes' : 'no'}`)
  console.log(`pictures in ${shots}`)
} finally {
  await rm(directory, { recursive: true, force: true })
}
