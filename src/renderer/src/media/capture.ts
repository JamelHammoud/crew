import type { MediaKind } from '../../../shared/media'

export interface CaptureResult {
  track: MediaStreamTrack | null
  problem: MediaKind | null
}

const ok = (track: MediaStreamTrack): CaptureResult => ({ track, problem: null })
const failed = (problem: MediaKind): CaptureResult => ({ track: null, problem })

function devices(): MediaDevices | null {
  return typeof navigator === 'undefined' ? null : (navigator.mediaDevices ?? null)
}

async function allowed(kind: 'microphone' | 'camera'): Promise<boolean> {
  const bridge = globalThis.window?.crew
  if (!bridge?.askForMedia) return true
  return bridge.askForMedia(kind).catch(() => false)
}

export async function captureMic(): Promise<CaptureResult> {
  const media = devices()
  if (!media || !(await allowed('microphone'))) return failed('microphone')
  try {
    const stream = await media.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    })
    const [track] = stream.getAudioTracks()
    return track ? ok(track) : failed('microphone')
  } catch {
    return failed('microphone')
  }
}

export async function captureCamera(): Promise<CaptureResult> {
  const media = devices()
  if (!media || !(await allowed('camera'))) return failed('camera')
  try {
    const stream = await media.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
    })
    const [track] = stream.getVideoTracks()
    if (!track) return failed('camera')
    track.contentHint = 'motion'
    return ok(track)
  } catch {
    return failed('camera')
  }
}

export async function captureScreen(sourceId: string): Promise<CaptureResult> {
  const media = devices()
  if (!media?.getDisplayMedia) return failed('screen')
  try {
    await globalThis.window?.crew?.pickScreenSource(sourceId)
    const stream = await media.getDisplayMedia({ video: { frameRate: { ideal: 30 } }, audio: false })
    const [track] = stream.getVideoTracks()
    if (!track) return failed('screen')
    track.contentHint = 'detail'
    return ok(track)
  } catch {
    return failed('screen')
  } finally {
    await globalThis.window?.crew?.pickScreenSource(null).catch(() => {})
  }
}

export function stop(track: MediaStreamTrack | null): void {
  track?.stop()
}
