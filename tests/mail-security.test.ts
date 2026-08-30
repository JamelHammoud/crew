import { act, cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import HtmlMessage from '../src/renderer/src/components/mail/HtmlMessage'

class Observer {
  observe(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  Object.assign(globalThis, { ResizeObserver: Observer, IS_REACT_ACT_ENVIRONMENT: true })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

async function draw(html: string): Promise<HTMLIFrameElement> {
  const view = render(createElement(HtmlMessage, { html, text: '' }))
  const frame = view.container.querySelector('iframe') as HTMLIFrameElement
  await act(async () => fireEvent.load(frame))
  return frame
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
    await act(async () => fireEvent.load(frame))
    openExternal.mockClear()

    await act(async () => {
      document.querySelector('#web')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      document.querySelector('#mail')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      document.querySelector('#local')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    expect(new Set(openExternal.mock.calls.map(call => call[0]))).toEqual(
      new Set(['https://crew.test/read', 'mailto:ali@example.com'])
    )
  })
})
