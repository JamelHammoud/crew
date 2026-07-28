// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement, createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.stubEnv('VITE_KLIPY_KEY', 'crew-test-key')

Element.prototype.getAnimations ??= () => []

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver ??= TestResizeObserver as unknown as typeof ResizeObserver

const { useCrew, CHAT_KEY, pendingCount } = await import('../src/renderer/src/state/store')
const { useHuddle } = await import('../src/renderer/src/state/huddle')
const { emptyRoom } = await import('../src/shared/huddle')
const AddMenu = (await import('../src/renderer/src/components/AddMenu')).default
const Composer = (await import('../src/renderer/src/components/Composer')).default

const GIF_BYTES = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])

const item = (slug: string, title: string, width = 200, height = 200) => ({
  id: slug,
  slug,
  title,
  file: {
    sm: { gif: { url: `https://static.klipy.com/${slug}-sm.gif`, width, height, size: 40_000 } },
    md: { gif: { url: `https://static.klipy.com/${slug}-md.gif`, width, height, size: 400_000 } }
  }
})

interface Answer {
  ok: boolean
  status: number
  json?: () => Promise<unknown>
  blob?: () => Promise<Blob>
}

const page = (items: unknown[], hasNext = false): Answer => ({
  ok: true,
  status: 200,
  json: async () => ({ result: true, data: { data: items, current_page: 1, per_page: 24, has_next: hasNext } })
})

let asked: string[] = []

const answer = vi.fn(async (url: string): Promise<Answer> => {
  asked.push(url)
  if (url.endsWith('.gif')) {
    return { ok: true, status: 200, blob: async () => new Blob([GIF_BYTES], { type: 'image/gif' }) }
  }
  if (url.includes('/gifs/search')) return page([item('lol-cat-1', 'Laughing cat')])
  return page([item('hello-hi-662', 'Hello'), item('bye-now-11', 'Bye', 200, 300)])
})

const join = vi.fn(async () => {})

beforeEach(() => {
  asked = []
  answer.mockClear()
  join.mockClear()
  vi.stubGlobal('fetch', answer)
  useCrew.setState({ pending: {} })
  useHuddle.setState({ room: emptyRoom(), joined: false, join })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const openMenu = (onSend = vi.fn()) => {
  render(createElement(AddMenu, { attachmentKey: CHAT_KEY, onSend }))
  fireEvent.click(screen.getByLabelText('Add to your message'))
  return onSend
}

const openPicker = async (onSend = vi.fn()) => {
  openMenu(onSend)
  fireEvent.click(screen.getByText('Pick a GIF'))
  await screen.findByLabelText('Send Hello')
  return onSend
}

describe('the plus button on the composer', () => {
  it('opens a menu rather than the file dialog, and each row wears its own mark', () => {
    openMenu()

    const upload = screen.getByText('Upload a file').closest('button')!
    const gif = screen.getByText('Pick a GIF').closest('button')!
    expect(upload.querySelector('svg')).not.toBeNull()
    expect(gif.querySelector('svg')).not.toBeNull()
    expect(upload.querySelector('svg')!.innerHTML).not.toBe(gif.querySelector('svg')!.innerHTML)
  })

  it('stays lit for as long as the menu it opened is up', () => {
    openMenu()
    const button = screen.getByLabelText('Add to your message')
    expect(button.getAttribute('data-active')).toBe('')

    fireEvent.click(button)
    expect(button.getAttribute('data-active')).toBeNull()
  })

  it('holds the tooltip back while the menu it opens is up', () => {
    vi.useFakeTimers()
    render(createElement(AddMenu, { attachmentKey: CHAT_KEY, onSend: vi.fn() }))
    const button = screen.getByLabelText('Add to your message')

    fireEvent.mouseEnter(button.parentElement!)
    act(() => vi.advanceTimersByTime(400))
    expect(screen.getAllByText('Add to your message').length).toBeGreaterThan(0)

    fireEvent.mouseLeave(button.parentElement!)
    fireEvent.click(button)
    fireEvent.mouseEnter(button.parentElement!)
    act(() => vi.advanceTimersByTime(400))

    expect(screen.queryByText('Add to your message')).toBeNull()
    vi.useRealTimers()
  })
})

describe('the GIF picker', () => {
  it('opens inside the same popover, on what is trending, with a search of its own', async () => {
    await openPicker()

    expect(screen.getByPlaceholderText('Search GIFs')).not.toBeNull()
    expect(screen.queryByText('Upload a file')).toBeNull()
    expect(asked[0]).toContain('/api/v1/crew-test-key/gifs/trending')
    expect(screen.getByLabelText('Send Bye')).not.toBeNull()
  })

  it('searches for what was typed', async () => {
    await openPicker()
    fireEvent.change(screen.getByPlaceholderText('Search GIFs'), { target: { value: 'lol' } })

    await screen.findByLabelText('Send Laughing cat')
    expect(asked.some(url => url.includes('/gifs/search') && url.includes('q=lol'))).toBe(true)
  })

  it('draws the small copy in the grid and hangs a skeleton behind it until it lands', async () => {
    await openPicker()
    const tile = screen.getByLabelText('Send Hello')

    expect(tile.querySelector('img')!.getAttribute('src')).toBe('https://static.klipy.com/hello-hi-662-sm.gif')
    expect(tile.querySelector('[data-skeleton]')).not.toBeNull()
  })

  it('sends the GIF the moment it is picked, without anything being typed', async () => {
    const onSend = await openPicker()
    fireEvent.click(screen.getByLabelText('Send Hello'))

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1))
    const attached = useCrew.getState().pending[CHAT_KEY]!
    expect(attached).toHaveLength(1)
    expect(attached[0].mime).toBe('image/gif')
    expect(attached[0].name).toBe('hello-hi-662.gif')
    expect(asked).toContain('https://static.klipy.com/hello-hi-662-md.gif')
  })

  it('carries the picture itself rather than a link to the service', async () => {
    await openPicker()
    fireEvent.click(screen.getByLabelText('Send Hello'))

    await waitFor(() => expect(useCrew.getState().pending[CHAT_KEY]).toHaveLength(1))
    expect(useCrew.getState().pending[CHAT_KEY]![0].data.length).toBeGreaterThan(0)
  })

  it('is counted the moment it is attached, so the guard on an empty message lets it through', async () => {
    await openPicker()
    fireEvent.click(screen.getByLabelText('Send Hello'))

    await waitFor(() => expect(pendingCount(CHAT_KEY)).toBe(1))
  })

  it('closes the menu once the GIF has gone', async () => {
    await openPicker()
    fireEvent.click(screen.getByLabelText('Send Hello'))

    await waitFor(() => expect(screen.queryByPlaceholderText('Search GIFs')).toBeNull())
  })

  it('keeps the grid and marks the one tile when a GIF will not come down', async () => {
    await openPicker()
    answer.mockImplementationOnce(async () => ({ ok: false, status: 502 }))
    fireEvent.click(screen.getByLabelText('Send Hello'))

    const marked = await screen.findByLabelText('Would not send')
    expect(screen.getByLabelText('Send Hello').contains(marked)).toBe(true)
    expect(screen.getByLabelText('Send Bye')).not.toBeNull()
    expect(useCrew.getState().pending[CHAT_KEY] ?? []).toHaveLength(0)
  })

  it('keeps the field it opened on rather than handing focus back to the composer', async () => {
    const inputRef = createRef<HTMLTextAreaElement>() as React.RefObject<HTMLTextAreaElement>
    render(
      createElement(Composer, {
        attachmentKey: CHAT_KEY,
        value: '',
        placeholder: 'Message the crew',
        inputRef,
        onChange: () => {},
        onKeyDown: () => {},
        onSend: () => {}
      })
    )
    fireEvent.click(screen.getByLabelText('Add to your message'))
    fireEvent.click(screen.getByText('Pick a GIF'))

    const field = await screen.findByPlaceholderText('Search GIFs')
    field.focus()
    fireEvent.click(field)

    expect(document.activeElement).toBe(field)
  })

  it('carries no way back and nothing under the grid', async () => {
    await openPicker()

    expect(screen.queryByLabelText('Back to the menu')).toBeNull()
    expect(screen.queryByText('Picking one sends it')).toBeNull()
  })

  it('takes the mark off the tile once the search moves on', async () => {
    await openPicker()
    answer.mockImplementationOnce(async () => ({ ok: false, status: 502 }))
    fireEvent.click(screen.getByLabelText('Send Hello'))
    await screen.findByLabelText('Would not send')

    fireEvent.change(screen.getByPlaceholderText('Search GIFs'), { target: { value: 'lol' } })
    await screen.findByLabelText('Send Laughing cat')
    expect(screen.queryByLabelText('Would not send')).toBeNull()
  })

  it('offers a way to clear what was typed, and puts what is trending back', async () => {
    await openPicker()
    expect(screen.queryByLabelText('Clear search')).toBeNull()

    fireEvent.change(screen.getByPlaceholderText('Search GIFs'), { target: { value: 'lol' } })
    await screen.findByLabelText('Send Laughing cat')

    fireEvent.click(screen.getByLabelText('Clear search'))
    await screen.findByLabelText('Send Hello')
    expect((screen.getByPlaceholderText('Search GIFs') as HTMLInputElement).value).toBe('')
  })

  it('says so plainly when nothing comes back', async () => {
    answer.mockImplementationOnce(async () => page([]))
    openMenu()
    fireEvent.click(screen.getByText('Pick a GIF'))

    expect(await screen.findByText('No GIFs found')).not.toBeNull()
  })

  it('says so plainly when the service will not answer', async () => {
    answer.mockImplementationOnce(async () => ({ ok: false, status: 503, json: async () => ({}) }))
    openMenu()
    fireEvent.click(screen.getByText('Pick a GIF'))

    expect(await screen.findByText('GIFs are not loading right now')).not.toBeNull()
  })
})
