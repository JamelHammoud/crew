import { desktopCapturer, shell, systemPreferences, type Session } from 'electron'
import type { MediaAccess, MediaKind, ScreenSource } from '../shared/media'

const THUMBNAIL = { width: 640, height: 400 }
const ICON = { width: 32, height: 32 }

const SETTINGS_PANES: Record<MediaKind, string> = {
  microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
  camera: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Camera',
  screen: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
}

// The chosen source is handed over just before the renderer asks for the
// stream, so the request handler answers without a second round trip.
let pending: string | null = null

export function pickScreenSource(id: string | null): void {
  pending = typeof id === 'string' && id ? id : null
}

export function installDisplayMedia(session: Session): void {
  session.setDisplayMediaRequestHandler((_request, callback) => {
    const wanted = pending
    pending = null
    if (!wanted) {
      callback({})
      return
    }
    desktopCapturer
      .getSources({ types: ['screen', 'window'] })
      .then(sources => {
        const source = sources.find(s => s.id === wanted)
        callback(source ? { video: source } : {})
      })
      .catch(() => callback({}))
  })
}

export function mediaAccess(kind: MediaKind): MediaAccess {
  if (process.platform !== 'darwin') return 'granted'
  const status = systemPreferences.getMediaAccessStatus(kind)
  if (status === 'granted' || status === 'denied' || status === 'restricted') return status
  return 'unknown'
}

export async function askForMedia(kind: 'microphone' | 'camera'): Promise<boolean> {
  if (process.platform !== 'darwin') return true
  if (systemPreferences.getMediaAccessStatus(kind) === 'granted') return true
  return systemPreferences.askForMediaAccess(kind)
}

// Screen recording is the one permission macOS will not let an app ask for, so
// the app opens the pane and the person turns it on themselves.
export function openMediaSettings(kind: MediaKind): void {
  if (process.platform !== 'darwin') return
  void shell.openExternal(SETTINGS_PANES[kind])
}

export async function screenSources(): Promise<ScreenSource[]> {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: THUMBNAIL,
    fetchWindowIcons: true
  })
  return sources
    .filter(source => !source.thumbnail.isEmpty())
    .map(source => ({
      id: source.id,
      name: source.name,
      kind: source.id.startsWith('screen:') ? ('screen' as const) : ('window' as const),
      thumbnail: source.thumbnail.toDataURL(),
      icon: source.appIcon && !source.appIcon.isEmpty() ? source.appIcon.resize(ICON).toDataURL() : null
    }))
}
