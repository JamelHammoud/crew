// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScanReport } from '../src/shared/scan'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver
Element.prototype.getAnimations ??= () => []

const { useBrowser } = await import('../src/renderer/src/state/browser')
const { useScan } = await import('../src/renderer/src/state/scan')
const { useCrew } = await import('../src/renderer/src/state/store')
const BrowserPanel = (await import('../src/renderer/src/components/BrowserPanel')).default

const found = (): ScanReport => ({
  kind: 'found',
  at: 1,
  counts: { critical: 1, high: 0, medium: 0, low: 1, info: 0 },
  findings: [
    { id: 'one', title: 'A key written into the code', file: 'src/db.ts', line: 42, severity: 'critical' },
    { id: 'two', title: 'A path built out of what was typed', file: 'src/read.ts', line: 8, severity: 'low' }
  ]
})

const scanner = (report: ScanReport, extra: Record<string, unknown> = {}) => {
  window.crew = {
    warmTerminal: () => undefined,
    readFile: vi.fn().mockResolvedValue(null),
    scanProject: vi.fn().mockResolvedValue(report),
    ...extra
  } as unknown as CrewBridge
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  scanner(found())
  useBrowser.setState({ open: false, tabs: [], activeTabId: null, closedPlans: [], closedBoards: [] })
  useScan.setState({ folder: null, report: null, running: false })
  useCrew.setState({ threads: {}, openThreadId: null, events: [], folder: '/work/thing' })
})

afterEach(cleanup)

const openScan = () => act(() => useBrowser.getState().openScan())

describe('scanning a project', () => {
  it('is one of the things the panel can hold', () => {
    act(() => useBrowser.getState().togglePanel())
    const { getByText } = render(createElement(BrowserPanel))

    fireEvent.click(getByText('Security'))

    expect(useBrowser.getState().tabs.map(t => t.kind)).toEqual(['scan'])
  })

  it('opens the one that is already standing rather than a second of it', () => {
    openScan()
    openScan()

    expect(useBrowser.getState().tabs).toHaveLength(1)
  })

  it('says what was found, worst first', async () => {
    openScan()
    const { getByText, findByText } = render(createElement(BrowserPanel))

    expect(await findByText('A key written into the code')).not.toBeNull()
    expect(getByText('src/db.ts:42')).not.toBeNull()
    const rows = [...document.querySelectorAll('button')].map(one => one.textContent ?? '')
    const key = rows.findIndex(one => one.includes('A key written into the code'))
    const path = rows.findIndex(one => one.includes('A path built out of what was typed'))
    expect(key).toBeLessThan(path)
  })

  it('counts the problems in the one line it has', async () => {
    openScan()
    const { findByText } = render(createElement(BrowserPanel))

    expect(await findByText('2 problems')).not.toBeNull()
  })

  it('opens the file a finding is in, at the line it is on', async () => {
    openScan()
    const { findByText } = render(createElement(BrowserPanel))

    fireEvent.click(await findByText('A key written into the code'))

    const opened = useBrowser.getState().tabs.find(t => t.kind === 'file')
    expect(opened).toMatchObject({ path: 'src/db.ts', line: 42 })
  })

  it('says a clean scan is clean rather than saying nothing', async () => {
    scanner({ kind: 'found', at: 1, findings: [], counts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 } })
    openScan()
    const { findByText } = render(createElement(BrowserPanel))

    expect(await findByText('Nothing found')).not.toBeNull()
  })

  it('hands over the way to get the scanner when the machine has none', async () => {
    const openExternal = vi.fn().mockResolvedValue(true)
    scanner({ kind: 'missing' }, { openExternal })
    openScan()
    const { findByText } = render(createElement(BrowserPanel))

    fireEvent.click(await findByText('Get ThreatCrush'))

    expect(openExternal).toHaveBeenCalledWith('https://threatcrush.com')
  })

  it('says why a scan that fell over fell over', async () => {
    scanner({ kind: 'failed', message: 'no such directory' })
    openScan()
    const { findByText } = render(createElement(BrowserPanel))

    expect(await findByText('The scan did not finish')).not.toBeNull()
    expect(await findByText('no such directory')).not.toBeNull()
  })

  it('asks for a project before it asks for a scan', async () => {
    scanner({ kind: 'nowhere' })
    openScan()
    const { findByText } = render(createElement(BrowserPanel))

    expect(await findByText('Open a project to scan it')).not.toBeNull()
  })

  it('keeps what it found when the tab is left and come back to', async () => {
    openScan()
    const { findByText, rerender } = render(createElement(BrowserPanel))
    await findByText('2 problems')

    act(() => useBrowser.getState().openMusic())
    rerender(createElement(BrowserPanel))
    act(() => useBrowser.getState().openScan())

    expect(await findByText('2 problems')).not.toBeNull()
    expect(window.crew.scanProject).toHaveBeenCalledTimes(1)
  })

  it('scans the project it is standing in when that changes', async () => {
    openScan()
    const { findByText } = render(createElement(BrowserPanel))
    await findByText('2 problems')

    act(() => useCrew.setState({ folder: '/work/other' }))

    await waitFor(() => expect(window.crew.scanProject).toHaveBeenCalledTimes(2))
  })

  it('scans again when it is asked to', async () => {
    openScan()
    const { findByLabelText, findByText } = render(createElement(BrowserPanel))
    await findByText('2 problems')

    fireEvent.click(await findByLabelText('Scan again'))

    await waitFor(() => expect(window.crew.scanProject).toHaveBeenCalledTimes(2))
  })
})
