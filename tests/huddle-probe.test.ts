// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../src/renderer/src/App'
import { useHuddle } from '../src/renderer/src/state/huddle'
import { closeSettings } from '../src/renderer/src/state/settings'
import { useCrew } from '../src/renderer/src/state/store'
import type { HuddlePeer } from '../src/shared/huddle'
import type { ScreenSource } from '../src/shared/media'
import { landed } from './helpers/boot'
import { installLocalStorage } from './helpers/local-storage'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver
Element.prototype.getAnimations ??= () => []
landed()

const bridge = {
  screenSources: (): Promise<ScreenSource[]> => Promise.resolve([]),
  pickScreenSource: () => Promise.resolve(),
  askForMedia: () => Promise.resolve(true),
  openMediaSettings: () => Promise.resolve(),
  onNotificationOpen: () => () => {},
  setBadge: () => Promise.resolve()
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

const openToolbox = () => fireEvent.click(screen.getByLabelText('Toolbox'))

const emptyStream = (): MediaStream => ({ getVideoTracks: () => [] }) as unknown as MediaStream

const DEVICES = [
  { deviceId: 'mic-built-in', kind: 'audioinput', label: 'MacBook Pro Microphone', groupId: '1' },
  { deviceId: 'mic-usb', kind: 'audioinput', label: 'Shure MV7', groupId: '2' },
  { deviceId: 'cam-built-in', kind: 'videoinput', label: 'FaceTime HD Camera', groupId: '1' },
  { deviceId: 'cam-usb', kind: 'videoinput', label: 'Logitech Brio', groupId: '3' }
]

type FakeTrack = ReturnType<typeof fakeTrack>

const fakeTrack = (kind: 'audio' | 'video', deviceId: string) => {
  const track = Object.assign(new EventTarget(), {
    kind,
    muted: false,
    readyState: 'live',
    contentHint: '',
    getSettings: () => ({ deviceId }),
    stop: (): void => {}
  })
  track.stop = () => {
    track.readyState = 'ended'
  }
  return track
}

class FakeStream {
  constructor(private tracks: FakeTrack[] = []) {}
  getTracks(): FakeTrack[] {
    return this.tracks
  }
  getAudioTracks(): FakeTrack[] {
    return this.tracks.filter(track => track.kind === 'audio')
  }
  getVideoTracks(): FakeTrack[] {
    return this.tracks.filter(track => track.kind === 'video')
  }
}

global.MediaStream ??= FakeStream as unknown as typeof MediaStream

const storage = installLocalStorage()

// A track exists from the moment the connection does and stays quiet until the
// other end starts sending, which is what the browser reports as muted.
const fakeVideo = (): { stream: MediaStream; arrive: () => void } => {
  const track = Object.assign(new EventTarget(), { kind: 'video', muted: true, readyState: 'live' })
  return {
    stream: { getVideoTracks: () => [track] } as unknown as MediaStream,
    arrive: () =>
      act(() => {
        track.muted = false
        track.dispatchEvent(new Event('unmute'))
      })
  }
}

describe('starting a huddle', () => {
  beforeEach(() => {
    session()
    useHuddle.setState({
      room: { id: null, peers: [], startedAt: null },
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
    closeSettings()
    cleanup()
  })

  it('offers a huddle from the toolbox', () => {
    render(createElement(App))
    openToolbox()

    expect(screen.getByText('Huddle')).toBeTruthy()
  })

  it('keeps the huddle out of the settings', () => {
    render(createElement(App))
    fireEvent.click(screen.getByLabelText('Settings'))

    expect(screen.queryByRole('button', { name: /huddle/i })).toBeNull()
  })

  // Getting into the call never waits on a device, so a machine with no
  // microphone at all still lands in the huddle with the controls in reach.
  it('gets into the call even when no microphone answers', async () => {
    render(createElement(App))
    openToolbox()
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
    openToolbox()
    await act(async () => {
      fireEvent.click(screen.getByText('Huddle'))
    })

    await waitFor(() => expect(screen.getByText('Open settings')).toBeTruthy())
    expect(screen.getByText(/could not reach your microphone/)).toBeTruthy()
  })

  it('offers the way out once you are in', async () => {
    render(createElement(App))
    openToolbox()
    await act(async () => {
      fireEvent.click(screen.getByText('Huddle'))
    })
    await waitFor(() => expect(useHuddle.getState().joined).toBe(true))

    openToolbox()
    const tile = screen.getByText('Huddle').closest('button')
    expect(tile?.getAttribute('aria-pressed')).toBe('true')
    await act(async () => {
      fireEvent.click(tile!)
    })
    expect(useHuddle.getState().joined).toBe(false)
  })
})

describe('a huddle you are not in', () => {
  beforeEach(() => {
    session()
    useHuddle.setState({
      room: { id: 'call-1', peers: [peer('a', 'Ali'), peer('b', 'Kim')], startedAt: 10 },
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

  // The faces overlap, and each one takes a bite out of the one behind it. The
  // bite has to be a hole rather than a ring painted in the surface colour, or
  // the blur the row sits on stops showing through.
  it('draws the faces overlapping, with a hole rather than a ring', () => {
    render(createElement(App))
    // The mark in the top left is drawn out of masked discs too, so the row of
    // faces is looked for inside the bar rather than anywhere on the screen.
    const bar = screen.getByText('Ali and Kim are in a huddle').parentElement
    const faces = [...(bar?.querySelectorAll('svg') ?? [])].find(svg => svg.querySelector('mask'))

    expect(faces).toBeTruthy()
    const cut = faces?.querySelector('mask circle')
    const behind = faces?.querySelector('g[mask]')
    const front = faces?.querySelectorAll('g')
    expect(cut).toBeTruthy()
    expect(behind).toBeTruthy()
    expect(front?.length).toBe(2)
    expect(front?.[1].getAttribute('mask')).toBeNull()
    // The hole is wider than the face that makes it, which is what leaves a gap.
    expect(Number(cut?.getAttribute('r'))).toBeGreaterThan(Number(behind?.querySelector('circle')?.getAttribute('r')))
  })
})

describe('a huddle you are in', () => {
  beforeEach(() => {
    session()
    useHuddle.setState({
      room: { id: 'call-1', peers: [peer('me', 'Jamel', { muted: true }), peer('a', 'Ali')], startedAt: Date.now() - 65_000 },
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

  it('gives everyone the same widescreen tile', () => {
    const { container } = render(createElement(App))

    expect(container.querySelectorAll('.aspect-video')).toHaveLength(2)
  })

  // The mark for who is talking has to be painted inside the tile. Drawn around
  // the outside it is cropped by the dock, by the rail beside a shared screen,
  // and by anything else that clips what it holds.
  it('marks who is talking inside the tile, where nothing can crop it', () => {
    const { container } = render(createElement(App))
    const tiles = [...container.querySelectorAll('.aspect-video')]

    expect(tiles).toHaveLength(2)
    for (const tile of tiles) expect(tile.className).not.toMatch(/(^|\s)(ring|shadow)-/)
    expect(container.querySelectorAll('.aspect-video > .inset-0.border-2')).toHaveLength(1)
    expect(container.querySelectorAll('.aspect-video > .inset-0.border')).toHaveLength(1)
  })

  it('marks the screen you picked inside its own thumbnail', async () => {
    const sources = bridge.screenSources
    bridge.screenSources = () =>
      Promise.resolve([
        { id: 'screen:1', name: 'Screen 1', kind: 'screen' as const, thumbnail: 'data:,', icon: null }
      ])
    const { container } = render(createElement(App))
    fireEvent.click(screen.getByLabelText('Share screen'))

    await waitFor(() => expect(screen.getByText('Screen 1')).toBeTruthy())
    const source = screen.getByText('Screen 1').closest('button')

    expect(source?.className).not.toMatch(/(^|\s)ring-/)
    expect([...(source?.children ?? [])].some(part => part.classList.contains('border-2'))).toBe(true)
    bridge.screenSources = sources
  })

  // A camera that has been turned on is not the same as pictures having turned
  // up. Swapping the face out too early leaves a black rectangle.
  it('keeps the face up until the pictures actually arrive', async () => {
    const camera = fakeVideo()
    useHuddle.setState({
      room: { id: 'call-1', peers: [peer('me', 'Jamel'), peer('a', 'Ali', { camera: true })], startedAt: 10 },
      remote: { a: { mic: emptyStream(), camera: camera.stream, screen: emptyStream() } },
      link: { a: 'connected' }
    })
    const { container } = render(createElement(App))

    expect(container.querySelector('video')).toBeNull()

    camera.arrive()
    await waitFor(() => expect(container.querySelector('video')).toBeTruthy())
  })
})

describe('picking a microphone and a camera', () => {
  const made: FakeTrack[] = []
  const asked: { audio: string | null; video: string | null } = { audio: null, video: null }

  const ideal = (constraint: MediaTrackConstraints | undefined): string | null =>
    (constraint?.deviceId as { ideal?: string } | undefined)?.ideal ?? null

  const mediaDevices = {
    enumerateDevices: () => Promise.resolve(DEVICES as MediaDeviceInfo[]),
    getUserMedia: (constraints: MediaStreamConstraints) => {
      const audio = constraints.audio as MediaTrackConstraints | undefined
      const kind = audio ? ('audio' as const) : ('video' as const)
      const id =
        ideal(audio ?? (constraints.video as MediaTrackConstraints | undefined)) ??
        (audio ? 'mic-built-in' : 'cam-built-in')
      asked[kind] = id
      const track = fakeTrack(kind, id)
      made.push(track)
      return Promise.resolve(new FakeStream([track]) as unknown as MediaStream)
    },
    addEventListener: () => {},
    removeEventListener: () => {}
  }

  const enter = async () => {
    render(createElement(App))
    openToolbox()
    await act(async () => {
      fireEvent.click(screen.getByText('Huddle'))
    })
    await waitFor(() => expect(useHuddle.getState().joined).toBe(true))
  }

  const open = async (label: string) => {
    await act(async () => {
      fireEvent.click(screen.getByLabelText(label))
    })
  }

  beforeEach(() => {
    session()
    made.length = 0
    asked.audio = null
    asked.video = null
    storage.clear()
    Object.defineProperty(navigator, 'mediaDevices', { value: mediaDevices, configurable: true })
    useHuddle.setState({
      room: { id: null, peers: [], startedAt: null },
      joined: false,
      joining: false,
      micOn: false,
      cameraOn: false,
      sharing: false,
      expanded: false,
      picking: false,
      speaking: [],
      problem: null,
      micId: null,
      cameraId: null,
      localCamera: null,
      localScreen: null,
      remote: {},
      link: {}
    })
  })

  afterEach(() => {
    cleanup()
    act(() => useHuddle.getState().leave())
    delete (navigator as { mediaDevices?: MediaDevices }).mediaDevices
  })

  it('lists what is plugged in and marks the one that is live', async () => {
    await enter()
    await open('Choose a microphone')

    expect(screen.getByText('Microphone')).toBeTruthy()
    expect(screen.getByText('Shure MV7')).toBeTruthy()
    const live = screen.getByText('MacBook Pro Microphone').closest('button')
    expect(live?.querySelector('svg')).toBeTruthy()
    expect(screen.getByText('Shure MV7').closest('button')?.querySelector('svg')).toBeNull()
  })

  // Right-click is the way the rest of the app opens a menu, so the notch on the
  // corner is a way in rather than the only one.
  it('opens the same menu on a right click', async () => {
    await enter()
    await act(async () => {
      fireEvent.contextMenu(screen.getByLabelText('Mute'))
    })

    expect(screen.getByText('Shure MV7')).toBeTruthy()
  })

  // Swapping the track into a slot that already exists is what keeps a call from
  // renegotiating, and the one being replaced is only stopped once it is out.
  it('swaps a live microphone for the one that was picked', async () => {
    await enter()
    await open('Choose a microphone')
    await act(async () => {
      fireEvent.click(screen.getByText('Shure MV7'))
    })

    await waitFor(() => expect(useHuddle.getState().micId).toBe('mic-usb'))
    expect(asked.audio).toBe('mic-usb')
    expect(made).toHaveLength(2)
    expect(made[0].readyState).toBe('ended')
    expect(made[1].readyState).toBe('live')
    expect(useHuddle.getState().micOn).toBe(true)
  })

  it('remembers the choice for the next call', async () => {
    await enter()
    await open('Choose a microphone')
    await act(async () => {
      fireEvent.click(screen.getByText('Shure MV7'))
    })

    await waitFor(() => expect(storage.getItem('crew.huddle.microphone')).toBe('mic-usb'))
  })

  // A camera picked while the camera is off is a choice, not a reason to start
  // filming. It is the one that comes on when the button beside it is pressed.
  it('holds a camera picked while the camera is off until it is turned on', async () => {
    await enter()
    await open('Choose a camera')
    await act(async () => {
      fireEvent.click(screen.getByText('Logitech Brio'))
    })

    await waitFor(() => expect(useHuddle.getState().cameraId).toBe('cam-usb'))
    expect(asked.video).toBeNull()

    await open('Start video')
    await waitFor(() => expect(useHuddle.getState().cameraOn).toBe(true))
    expect(asked.video).toBe('cam-usb')
  })

  // A microphone that was chosen once and has since been unplugged must not be
  // asked for in a way that fails, or someone lands in the call with nothing.
  it('asks for a remembered device without insisting on it', async () => {
    storage.setItem('crew.huddle.microphone', 'mic-gone')
    useHuddle.setState({ micId: 'mic-gone' })
    await enter()

    expect(asked.audio).toBe('mic-gone')
    expect(useHuddle.getState().micOn).toBe(true)
  })
})
