// @vitest-environment jsdom

import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const struck: string[] = []

vi.mock('../src/renderer/src/media/sounds', async importOriginal => ({
  ...(await importOriginal<typeof import('../src/renderer/src/media/sounds')>()),
  playSound: (name: string) => struck.push(name)
}))

const TasksPanel = (await import('../src/renderer/src/components/TasksPanel')).default
const { ARM_MS, GRACE_MS, useTasks } = await import('../src/renderer/src/state/tasks')

Element.prototype.getAnimations ??= () => []

const panel = () =>
  render(
    createElement(TasksPanel, {
      onOpenThread: () => {},
      onOpenThreadBeside: () => {}
    })
  )

const asideIn = (root: HTMLElement) => root.querySelector('aside') as HTMLElement
const scrimIn = (root: HTMLElement) => root.querySelector('.z-30')

const showing = () => {
  const { pinned, peeking } = useTasks.getState()
  return pinned || peeking
}

const wait = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

beforeEach(() => {
  vi.useFakeTimers()
  struck.length = 0
  useTasks.setState({ pinned: false, peeking: false })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
})

afterEach(() => {
  cleanup()
  useTasks.getState().close()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('opening the tasks panel by hovering the button', () => {
  it('opens on a hover that was held, without a press', () => {
    useTasks.getState().peek(true)
    wait(ARM_MS + 10)

    expect(useTasks.getState().peeking).toBe(true)
    expect(useTasks.getState().pinned).toBe(false)
  })

  it('stays shut for a pointer passing over on its way somewhere else', () => {
    useTasks.getState().peek(true)
    wait(ARM_MS - 40)
    useTasks.getState().peek(false)
    wait(1000)

    expect(showing()).toBe(false)
  })

  it('is held open by the panel the button is standing under', () => {
    useTasks.getState().peek(true)
    wait(ARM_MS + 10)
    useTasks.getState().peek(false)
    wait(GRACE_MS - 40)
    useTasks.getState().peek(true)
    wait(1000)

    expect(useTasks.getState().peeking).toBe(true)
  })

  it('lets it go once the pointer has left both for good', () => {
    useTasks.getState().peek(true)
    wait(ARM_MS + 10)
    useTasks.getState().peek(false)
    wait(GRACE_MS + 20)

    expect(showing()).toBe(false)
  })

  it('keeps a panel that was pressed, so reading it is not a race with the pointer', () => {
    useTasks.getState().peek(true)
    wait(ARM_MS + 10)
    useTasks.getState().keep()
    useTasks.getState().peek(false)
    wait(1000)

    expect(showing()).toBe(true)
    expect(useTasks.getState().pinned).toBe(true)
  })

  it('makes its sound for a press and never for a hover', () => {
    useTasks.getState().peek(true)
    wait(ARM_MS + 10)

    expect(struck).toEqual([])

    useTasks.getState().keep()

    expect(struck).toEqual([])

    useTasks.getState().close()
    useTasks.getState().toggle()

    expect(struck).toEqual(['tasks.open'])
  })

  it('says nothing again for a press on a panel that is already standing', () => {
    useTasks.getState().peek(true)
    wait(ARM_MS + 10)
    useTasks.getState().toggle()

    expect(struck).toEqual([])
    expect(useTasks.getState().pinned).toBe(true)
  })
})

describe('the panel itself', () => {
  it('holds the hover it did not start', () => {
    useTasks.getState().peek(true)
    wait(ARM_MS + 10)
    const { container } = panel()

    useTasks.getState().peek(false)
    fireEvent.mouseEnter(asideIn(container))
    wait(1000)

    expect(useTasks.getState().peeking).toBe(true)
  })

  it('goes when the pointer leaves it', () => {
    useTasks.getState().peek(true)
    wait(ARM_MS + 10)
    const { container } = panel()

    fireEvent.mouseLeave(asideIn(container))
    wait(GRACE_MS + 20)

    expect(showing()).toBe(false)
  })

  it('is kept by a press anywhere inside it', () => {
    useTasks.getState().peek(true)
    wait(ARM_MS + 10)
    const { container } = panel()

    fireEvent.mouseDown(asideIn(container))
    fireEvent.mouseLeave(asideIn(container))
    wait(1000)

    expect(useTasks.getState().pinned).toBe(true)
  })

  it('catches a click away only once it has been kept', () => {
    useTasks.getState().peek(true)
    wait(ARM_MS + 10)
    const { container, rerender } = panel()

    expect(scrimIn(container)).toBeNull()

    useTasks.getState().keep()
    act(() => {
      rerender(
        createElement(TasksPanel, {
          onOpenThread: () => {},
          onOpenThreadBeside: () => {}
        })
      )
    })

    expect(scrimIn(container)).not.toBeNull()
  })
})
