// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import BrowserPanel from '../src/renderer/src/components/BrowserPanel'
import { useBrowser } from '../src/renderer/src/state/browser'

if (!Element.prototype.getAnimations) {
  Element.prototype.getAnimations = () => []
}
if (!window.matchMedia) {
  window.matchMedia = (() => ({
    matches: false,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined
  })) as unknown as typeof window.matchMedia
}
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
}

type Opened = { id: string; cols: number; rows: number }

const opened: Opened[] = []
const closed: string[] = []
let warmed = 0
let sendData: (id: string, chunk: string) => void = () => undefined
let sendExit: (id: string) => void = () => undefined

beforeEach(() => {
  opened.length = 0
  closed.length = 0
  warmed = 0
  useBrowser.setState({ tabs: [], activeTabId: null })
  window.crew = {
    warmTerminal: () => void (warmed += 1),
    openTerminal: (id: string, size: { cols: number; rows: number }) => opened.push({ id, ...size }),
    writeTerminal: () => undefined,
    resizeTerminal: () => undefined,
    closeTerminal: (id: string) => closed.push(id),
    onTerminalData: (listener: (id: string, chunk: string) => void) => {
      sendData = listener
      return () => undefined
    },
    onTerminalExit: (listener: (id: string) => void) => {
      sendExit = listener
      return () => undefined
    }
  } as unknown as CrewBridge
})

afterEach(() => cleanup())

const newTab = (): void => void fireEvent.click(screen.getByLabelText('New tab'))
const only = () => useBrowser.getState().tabs[0]!
const screenText = (): string => document.querySelector('.xterm-rows')?.textContent ?? ''

describe('opening something new in the side panel', () => {
  it('has a shell warming before anyone asks for one', () => {
    render(createElement(BrowserPanel))
    expect(warmed).toBeGreaterThan(0)

    const early = warmed
    newTab()
    expect(warmed).toBeGreaterThan(early)
  })

  it('asks whether it should be a web page or a terminal', () => {
    render(createElement(BrowserPanel))
    newTab()

    expect(screen.getByText('Web page')).toBeTruthy()
    expect(screen.getByText('Terminal')).toBeTruthy()
    expect(useBrowser.getState().tabs).toHaveLength(0)
  })

  it('leaves a blank page waiting for an address', () => {
    render(createElement(BrowserPanel))
    newTab()
    fireEvent.click(screen.getByText('Web page'))

    expect(only().kind).toBe('web')
    expect(only().url).toBe('')
    expect(opened).toHaveLength(0)
  })

  it('starts a shell for a terminal', async () => {
    render(createElement(BrowserPanel))
    newTab()
    fireEvent.click(screen.getByText('Terminal'))

    expect(only().kind).toBe('terminal')
    await waitFor(() => expect(opened).toHaveLength(1))
    expect(opened[0]!.id).toBe(only().id)
    expect(opened[0]!.cols).toBeGreaterThan(0)
    expect(opened[0]!.rows).toBeGreaterThan(0)
  })
})

describe('a terminal tab', () => {
  const openTerminal = async (): Promise<string> => {
    render(createElement(BrowserPanel))
    newTab()
    fireEvent.click(screen.getByText('Terminal'))
    await waitFor(() => expect(opened).toHaveLength(1))
    return only().id
  }

  it('shows what the shell writes back', async () => {
    const id = await openTerminal()
    sendData(id, 'crew $ ls\r\nAGENTS.md\r\n')

    await waitFor(() => expect(screenText()).toContain('AGENTS.md'))
  })

  it('ignores anything meant for another terminal', async () => {
    const id = await openTerminal()
    sendData(`${id}-other`, 'not for this one')
    sendData(id, 'for this one')

    await waitFor(() => expect(screenText()).toContain('for this one'))
    expect(screenText()).not.toContain('not for this one')
  })

  it('takes its name from the shell', async () => {
    const id = await openTerminal()
    sendData(id, '\x1b]0;crew — zsh\x07')

    await waitFor(() => expect(only().title).toBe('crew — zsh'))
    expect(screen.getByText('crew — zsh')).toBeTruthy()
  })

  it('is called Terminal until the shell says otherwise', async () => {
    await openTerminal()

    expect(screen.getByText('Terminal')).toBeTruthy()
  })

  it('says when the shell has gone, and stays open', async () => {
    const id = await openTerminal()
    sendExit(id)

    await waitFor(() => expect(screenText()).toContain('[Process completed]'))
    expect(useBrowser.getState().tabs).toHaveLength(1)
  })

  it('closes the shell when the tab is closed', async () => {
    const id = await openTerminal()
    fireEvent.click(screen.getByLabelText('Close tab'))

    await waitFor(() => expect(closed).toEqual([id]))
    expect(useBrowser.getState().tabs).toHaveLength(0)
  })
})
