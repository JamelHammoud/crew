// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../src/renderer/src/App'
import { useHuddle } from '../src/renderer/src/state/huddle'
import { useCrew } from '../src/renderer/src/state/store'
import type { HuddlePeer } from '../src/shared/huddle'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver
Element.prototype.getAnimations ??= () => []

const bridge = {
  screenSources: () => Promise.resolve([]),
  pickScreenSource: () => Promise.resolve(),
  askForMedia: () => Promise.resolve(true),
  openMediaSettings: () => Promise.resolve(),
  onNotificationOpen: () => () => {}
}
Object.assign(window, { crew: bridge })

const peer = (peerId: string, name: string, extra: Partial<HuddlePeer> = {}): HuddlePeer => ({
  peerId,
  memberId: `m-${peerId}`,
  name,
  muted: false,
  camera: false,
  sharing: false,
  joinedAt: 1,
  ...extra
})

const session = () => {
  useCrew.setState({
    connection: 'online',
    selfId: 'jamel',
    selfName: 'Jamel',
    joinLink: 'crew://127.0.0.1:1234/abc',
    members: [{ id: 'jamel', name: 'Jamel', connected: true }],
    agents: [],
    events: [],
    threads: {},
    threadPrompts: {},
    threadDrafts: {},
    queues: {},
    steps: {},
    tokens: {},
    todos: [],
    boards: [],
    docs: {},
    pending: {},
    openThreadId: null
  })
}

const openMenu = () => fireEvent.click(screen.getByLabelText('Profile menu'))

describe('starting a huddle', () => {
  beforeEach(() => {
    session()
    useHuddle.setState({
      room: { peers: [], startedAt: null },
      joined: false,
      joining: false,
      micOn: false,
      cameraOn: false,
      sharing: false,
      expanded: false,
      picking: false,
      speaking: [],
      problem: null,
      localCamera: null,
      localScreen: null,
      remote: {},
      link: {}
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('offers a huddle from the profile menu', () => {
    render(createElement(App))
    openMenu()

    expect(screen.getByText('Huddle')).toBeTruthy()
  })

  it('names the huddle after who is already in it', () => {
    useHuddle.setState({ room: { peers: [peer('a', 'Ali')], startedAt: 10 } })
    render(createElement(App))
    openMenu()

    expect(screen.getByText('Join huddle')).toBeTruthy()
  })

  // Getting into the call never waits on a device, so a machine with no
  // microphone at all still lands in the huddle with the controls in reach.
  it('gets into the call even when no microphone answers', async () => {
    render(createElement(App))
    openMenu()
    await act(async () => {
      fireEvent.click(screen.getByText('Huddle'))
    })

    await waitFor(() => expect(useHuddle.getState().joined).toBe(true))
    expect(useHuddle.getState().micOn).toBe(false)
    expect(screen.getByLabelText('Unmute')).toBeTruthy()
    expect(screen.getByLabelText('Share screen')).toBeTruthy()
    expect(screen.getByLabelText('Leave')).toBeTruthy()
  })

  it('says what went wrong with the microphone and offers the way to fix it', async () => {
    render(createElement(App))
    openMenu()
    await act(async () => {
      fireEvent.click(screen.getByText('Huddle'))
    })

    await waitFor(() => expect(screen.getByText('Open settings')).toBeTruthy())
    expect(screen.getByText(/could not reach your microphone/)).toBeTruthy()
  })

  it('offers the way out once you are in', async () => {
    render(createElement(App))
    openMenu()
    await act(async () => {
      fireEvent.click(screen.getByText('Huddle'))
    })
    await waitFor(() => expect(useHuddle.getState().joined).toBe(true))

    openMenu()
    expect(screen.getByText('Leave huddle')).toBeTruthy()
  })
})

describe('a huddle you are not in', () => {
  beforeEach(() => {
    session()
    useHuddle.setState({
      room: { peers: [peer('a', 'Ali'), peer('b', 'Kim')], startedAt: 10 },
      joined: false,
      joining: false,
      expanded: false,
      picking: false,
      problem: null,
      remote: {},
      link: {},
      speaking: []
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('says who is in it and offers a way in', () => {
    render(createElement(App))

    expect(screen.getByText('Ali and Kim are in a huddle')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Join' })).toBeTruthy()
  })

  it('can be waved off without leaving the app', () => {
    render(createElement(App))
    fireEvent.click(screen.getByLabelText('Dismiss'))

    expect(screen.queryByText('Ali and Kim are in a huddle')).toBeNull()
  })
})

describe('a huddle you are in', () => {
  beforeEach(() => {
    session()
    useHuddle.setState({
      room: { peers: [peer('me', 'Jamel', { muted: true }), peer('a', 'Ali')], startedAt: Date.now() - 65_000 },
      peerId: 'me',
      joined: true,
      joining: false,
      micOn: false,
      cameraOn: false,
      sharing: false,
      expanded: false,
      picking: false,
      speaking: ['a'],
      problem: null,
      localCamera: null,
      localScreen: null,
      remote: {},
      link: {}
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('shows who is on the call and how long it has been running', () => {
    render(createElement(App))

    expect(screen.getAllByText('Ali').length).toBeGreaterThan(0)
    expect(screen.getByText('1:05')).toBeTruthy()
    expect(screen.queryByText(/is in a huddle/)).toBeNull()
  })

  it('opens onto the whole window and comes back', () => {
    render(createElement(App))

    fireEvent.click(screen.getByLabelText('Expand'))
    expect(useHuddle.getState().expanded).toBe(true)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useHuddle.getState().expanded).toBe(false)
  })

  it('asks which screen to share before sharing one', () => {
    render(createElement(App))
    fireEvent.click(screen.getByLabelText('Share screen'))

    expect(useHuddle.getState().picking).toBe(true)
  })
})
