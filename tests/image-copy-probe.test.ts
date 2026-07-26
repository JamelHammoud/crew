// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const copied = vi.hoisted(() => [] as string[])

vi.mock('electron', () => ({
  clipboard: { writeImage: (image: { from: string }) => copied.push(image.from) },
  nativeImage: {
    createFromDataURL: (url: string) => ({ from: url, isEmpty: () => !url.split(',')[1] }),
    createFromBuffer: (bytes: Buffer) => ({
      from: bytes.toString('utf8'),
      isEmpty: () => bytes.byteLength === 0
    })
  }
}))

const ImageView = (await import('../src/renderer/src/components/ImageView')).default
const { copyImage } = await import('../src/main/clipboard')

const PICTURE = 'data:image/png;base64,iVBORw0KGgo='
const ADDRESS = 'http://192.168.1.4:2739/attachments/a1b2.jpg'

const asked = vi.fn()

const served = (body: string, ok = true) =>
  vi.fn().mockResolvedValue({
    ok,
    arrayBuffer: async () => new TextEncoder().encode(body).buffer
  })

function open(src = PICTURE) {
  const { container } = render(createElement(ImageView, { src, alt: 'a1b2.jpg' }))
  const frame = container.querySelector('[data-image-frame]') as HTMLElement
  fireEvent.contextMenu(frame, { clientX: 120, clientY: 90 })
  return frame
}

beforeEach(() => {
  copied.length = 0
  asked.mockReset().mockResolvedValue(true)
  window.crew = { copyImage: asked } as unknown as typeof window.crew
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('right clicking a picture', () => {
  it('opens the menu crew draws itself, where the pointer is', () => {
    open()
    const menu = screen.getByText('Copy image').closest('.glass') as HTMLElement

    expect(menu).not.toBeNull()
    expect(menu.style.left).toBe('120px')
    expect(menu.style.top).toBe('90px')
  })

  it('leaves the picture alone until it is asked', () => {
    render(createElement(ImageView, { src: PICTURE, alt: 'a1b2.jpg' }))

    expect(screen.queryByText('Copy image')).toBeNull()
    expect(asked).not.toHaveBeenCalled()
  })

  it('hands the picture over to be copied and puts the menu away', () => {
    open(ADDRESS)
    fireEvent.click(screen.getByText('Copy image'))

    expect(asked).toHaveBeenCalledWith(ADDRESS)
    expect(screen.queryByText('Copy image')).toBeNull()
  })
})

describe('copying a picture', () => {
  it('writes one drawn into the page itself', async () => {
    expect(await copyImage(PICTURE)).toBe(true)
    expect(copied).toEqual([PICTURE])
  })

  it('fetches one that lives at an address', async () => {
    const fetching = served('png bytes')
    vi.stubGlobal('fetch', fetching)

    expect(await copyImage(ADDRESS)).toBe(true)
    expect(fetching).toHaveBeenCalledWith(ADDRESS)
    expect(copied).toEqual(['png bytes'])
  })

  it('copies nothing when there is no picture to copy', async () => {
    vi.stubGlobal('fetch', served('', false))

    expect(await copyImage(ADDRESS)).toBe(false)
    expect(await copyImage('data:image/png;base64,')).toBe(false)
    expect(await copyImage('about:blank')).toBe(false)
    expect(copied).toEqual([])
  })

  it('says so rather than throwing when the address cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    expect(await copyImage(ADDRESS)).toBe(false)
    expect(copied).toEqual([])
  })
})
