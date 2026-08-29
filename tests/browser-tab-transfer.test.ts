import { describe, expect, it, vi } from 'vitest'
import { BrowserTabTransfers, type BrowserTabTransferContents } from '../src/main/browser-tab-transfer'
import type { BrowserTab } from '../src/shared/browserTab'

const tab = {
  id: 'tab-8',
  kind: 'web',
  initialUrl: 'https://example.com/start',
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
  running: '',
  ran: [],
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
  pinned: false,
  generation: 0,
  plugin: null,
  pluginLabel: ''
} satisfies BrowserTab

function contents(id: number) {
  const send = vi.fn()
  const value = { id, isDestroyed: () => false, send } satisfies BrowserTabTransferContents
  return { value, send }
}

describe('Browser tab transfers', () => {
  it('adds the tab at the destination before removing it from the source', () => {
    const order: string[] = []
    const source = contents(1)
    const target = contents(2)
    source.send.mockImplementation(() => order.push('source'))
    target.send.mockImplementation(() => order.push('target'))
    const transfers = new BrowserTabTransfers(() => 'project-one')

    expect(transfers.begin(source.value, 'move-one', tab)).toBe(true)
    expect(transfers.drop(target.value, 'move-one', 3)).toBe(true)

    expect(target.send).toHaveBeenCalledWith('browser:insert-tab', tab, 3)
    expect(source.send).toHaveBeenCalledWith('browser:remove-tab', tab.id)
    expect(order).toEqual(['target', 'source'])
    expect(transfers.drop(target.value, 'move-one', 3)).toBe(false)
  })

  it('rejects a drop into a window looking at another project', () => {
    const source = contents(1)
    const target = contents(2)
    const transfers = new BrowserTabTransfers(id => (id === 1 ? 'project-one' : 'project-two'))

    transfers.begin(source.value, 'move-one', tab)

    expect(transfers.drop(target.value, 'move-one', 0)).toBe(false)
    expect(source.send).not.toHaveBeenCalled()
    expect(target.send).not.toHaveBeenCalled()
  })

  it('reorders a tab dropped back into its source window', () => {
    const source = contents(1)
    const transfers = new BrowserTabTransfers(() => 'project-one')

    transfers.begin(source.value, 'move-one', tab)

    expect(transfers.drop(source.value, 'move-one', 2)).toBe(true)
    expect(source.send).toHaveBeenCalledWith('browser:move-tab', tab.id, 2)
  })

  it('opens a dragged file tab without removing anything from either window', () => {
    const source = contents(1)
    const target = contents(2)
    const transfers = new BrowserTabTransfers(() => 'project-one')
    const file = { ...tab, id: 'file-tab', kind: 'file' as const, path: 'src/app.ts' }

    transfers.begin(source.value, 'open-one', file, true)

    expect(transfers.drop(target.value, 'open-one', 1)).toBe(true)
    expect(target.send).toHaveBeenCalledWith('browser:insert-tab', file, 1)
    expect(source.send).not.toHaveBeenCalled()
  })

  it('opens a dragged file tab in its source window too', () => {
    const source = contents(1)
    const transfers = new BrowserTabTransfers(() => 'project-one')
    const file = { ...tab, id: 'file-tab', kind: 'file' as const, path: 'src/app.ts' }

    transfers.begin(source.value, 'open-one', file, true)

    expect(transfers.drop(source.value, 'open-one', 2)).toBe(true)
    expect(source.send).toHaveBeenCalledWith('browser:insert-tab', file, 2)
    expect(source.send).not.toHaveBeenCalledWith('browser:move-tab', file.id, 2)
  })
})
