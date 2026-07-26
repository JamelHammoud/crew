import type { MediaKind } from '../../../shared/media'

export type InputKind = Exclude<MediaKind, 'screen'>

export interface InputDevice {
  id: string
  name: string
}

const SOURCES: Record<InputKind, MediaDeviceKind> = { microphone: 'audioinput', camera: 'videoinput' }
const UNNAMED: Record<InputKind, string> = { microphone: 'Microphone', camera: 'Camera' }
const KEYS: Record<InputKind, string> = { microphone: 'crew.huddle.microphone', camera: 'crew.huddle.camera' }

function devices(): MediaDevices | null {
  return typeof navigator === 'undefined' ? null : (navigator.mediaDevices ?? null)
}

// A device only carries its name once its permission has been given, so one
// that has not been named yet is numbered rather than left blank.
export async function listInputs(kind: InputKind): Promise<InputDevice[]> {
  const media = devices()
  if (!media?.enumerateDevices) return []
  try {
    const all = await media.enumerateDevices()
    return all
      .filter(device => device.kind === SOURCES[kind] && device.deviceId)
      .map((device, index) => ({ id: device.deviceId, name: device.label || `${UNNAMED[kind]} ${index + 1}` }))
  } catch {
    return []
  }
}

export function onInputsChange(listen: () => void): () => void {
  const media = devices()
  media?.addEventListener?.('devicechange', listen)
  return () => media?.removeEventListener?.('devicechange', listen)
}

export function storedInput(kind: InputKind): string | null {
  return globalThis.localStorage?.getItem(KEYS[kind]) ?? null
}

export function rememberInput(kind: InputKind, id: string): void {
  try {
    globalThis.localStorage?.setItem(KEYS[kind], id)
  } catch {
    // Storage turned off keeps the choice for this call and no longer.
  }
}
