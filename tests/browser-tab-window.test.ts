import { describe, expect, it, vi } from 'vitest'
import type { BrowserWindow } from 'electron'
import { openBrowserTabWindow } from '../src/main/browser-tab-window'
import type { BrowserTab } from '../src/shared/browserTab'

const tab = {
  id: 'tab-8',
  kind: 'web',
  initialUrl: 'https://example.com',
  url: 'https://example.com/current',
  title: 'Current',
  favicon: null,
  loading: false,
  error: '',
  canGoBack: true,
  canGoForward: false,
  path: '',
  line: null,
  diff: null,
  command: null,
  folder: '',
  mime: '',
  size: 0,
  game: null,
  threadId: '',
  parentThreadId: '',
  back: [],
  forward: [],
  tree: false,
  open: [],
  preview: false,
  generation: 0,
  plugin: null,
  pluginLabel: ''
} satisfies BrowserTab

function windowDouble() {
  let loaded: (() => void) | null = null
  const send = vi.fn()
  const destroy = vi.fn()
  const win = {
    destroy,
    webContents: {
      id: 22,
      once: vi.fn((_event: string, listener: () => void) => {
        loaded = listener
      }),
      isDestroyed: vi.fn(() => false),
      send
    }
  } as unknown as BrowserWindow
  return { win, send, destroy, finish: () => loaded?.() }
}

describe('a Browser tab window', () => {
  it('joins the asking window project before loading and hands the tab over when ready', () => {
    const made = windowDouble()
    const order: string[] = []

    const opened = openBrowserTabWindow(tab, 'project-one', {
      create: () => {
        order.push('create')
        return made.win
      },
      join: (id, place) => {
        order.push(`join:${id}:${place}`)
        return {}
      },
      load: () => order.push('load')
    })

    expect(opened).toBe(true)
    expect(order).toEqual(['create', 'join:22:project-one', 'load'])
    expect(made.send).not.toHaveBeenCalled()
    made.finish()
    expect(made.send).toHaveBeenCalledWith('browser:open-tab', tab)
  })

  it('does not make a window without a project', () => {
    const create = vi.fn()

    expect(openBrowserTabWindow(tab, null, { create, join: vi.fn(), load: vi.fn() })).toBe(false)
    expect(create).not.toHaveBeenCalled()
  })

  it('destroys a window that cannot join the project', () => {
    const made = windowDouble()
    const load = vi.fn()

    expect(openBrowserTabWindow(tab, 'project-one', { create: () => made.win, join: () => null, load })).toBe(false)
    expect(made.destroy).toHaveBeenCalledOnce()
    expect(load).not.toHaveBeenCalled()
  })
})
