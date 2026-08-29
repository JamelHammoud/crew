// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Sidebar from '../src/renderer/src/components/Sidebar'
import { usePlaces } from '../src/renderer/src/state/places'
import { useCrew } from '../src/renderer/src/state/store'
import type { LivePlace } from '../src/shared/places'
import type { LiveThread } from '../src/shared/threads'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver
Element.prototype.getAnimations ??= () => []

const drawn = vi.hoisted(() => ({ groups: 0, rows: 0 }))

vi.mock('../src/renderer/src/components/sidebar/PlaceGroup', async () => {
  const { createElement, memo } = await import('react')
  const actual = await vi.importActual<typeof import('../src/renderer/src/components/sidebar/PlaceGroup')>(
    '../src/renderer/src/components/sidebar/PlaceGroup'
  )
  const { samePlaceGroup } = await import('../src/renderer/src/components/sidebar/placeItems')
  const real = actual.default
  return {
    ...actual,
    default: memo((props: Parameters<typeof real>[0]) => {
      drawn.groups += 1
      return createElement(real, props)
    }, samePlaceGroup)
  }
})

vi.mock('../src/renderer/src/components/sidebar/ThreadRow', async () => {
  const { createElement, memo } = await import('react')
  const actual = await vi.importActual<typeof import('../src/renderer/src/components/sidebar/ThreadRow')>(
    '../src/renderer/src/components/sidebar/ThreadRow'
  )
  const { sameThreadRow } = await import('../src/renderer/src/components/sidebar/placeItems')
  const real = actual.default
  return {
    ...actual,
    default: memo((props: Parameters<typeof real>[0]) => {
      drawn.rows += 1
      return createElement(real, props)
    }, sameThreadRow)
  }
})

const PLACES = 12
const PER_PLACE = 4
const HERE = 'project:/work/place-3'

const folderOf = (index: number): string => `/work/place-${index}`
const keyOf = (index: number): string => `project:${folderOf(index)}`

const threadsOf = (index: number, working = false): LiveThread[] =>
  Array.from({ length: PER_PLACE }, (_, row) => ({
    id: `${keyOf(index)}/thread-${row}`,
    title: `the ${row}th piece in place ${index}`,
    preview: `the ${row}th piece in place ${index}`,
    working: working && row === 0
  }))

const liveOf = (workingAt: number | null): LivePlace[] =>
  Array.from({ length: PLACES }, (_, index) => ({
    key: keyOf(index),
    folder: folderOf(index),
    name: `place ${index}`,
    hosting: true,
    threads: threadsOf(index, workingAt === index)
  }))

const projects = Array.from({ length: PLACES }, (_, index) => ({
  folder: folderOf(index),
  openedAt: 1000 - index,
  home: 'project' as const
}))

const settle = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve()
  })
}

const openRail = async (): Promise<void> => {
  usePlaces.setState({ places: [], live: [] })
  useCrew.setState({ place: HERE, openThreadIds: [], selfName: 'ALI' })
  render(createElement(Sidebar, { tab: 'chat' as const, onTab: () => {} }))
  await settle()
  drawn.groups = 0
  drawn.rows = 0
}

beforeEach(() => {
  window.crew = {
    projects: async () => projects,
    recentJoins: async () => [],
    liveProjects: async () => liveOf(null),
    onLive: () => () => {}
  } as unknown as typeof window.crew
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('what the rail draws again', () => {
  it('draws nothing again when a step lands in a thread', async () => {
    await openRail()

    act(() => {
      useCrew.setState({ steps: { 'prompt-1': [] } })
    })

    expect(drawn.groups).toBe(0)
    expect(drawn.rows).toBe(0)
  })

  it('draws nothing again while somebody types', async () => {
    await openRail()

    act(() => {
      useCrew.setState({ chatDraft: 'hello' })
    })

    expect(drawn.groups).toBe(0)
    expect(drawn.rows).toBe(0)
  })

  it('draws only the thread that started working, in only its own place', async () => {
    await openRail()

    act(() => {
      usePlaces.setState({ live: liveOf(5) })
    })

    expect(drawn.groups).toBe(1)
    expect(drawn.rows).toBe(1)
  })

  it('draws nothing again when the same threads are pushed a second time', async () => {
    await openRail()

    act(() => {
      usePlaces.setState({ live: liveOf(null) })
    })

    expect(drawn.groups).toBe(0)
    expect(drawn.rows).toBe(0)
  })

  it('draws the rows of a place that gained a thread and leaves the others alone', async () => {
    await openRail()

    act(() => {
      usePlaces.setState({
        live: liveOf(null).map(place =>
          place.key === keyOf(2)
            ? {
                ...place,
                threads: [{ id: `${keyOf(2)}/fresh`, title: 'something new', working: false }, ...place.threads]
              }
            : place
        )
      })
    })

    expect(drawn.groups).toBe(1)
    expect(drawn.rows).toBe(1)
  })
})
