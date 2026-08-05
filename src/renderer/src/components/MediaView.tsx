import { useEffect, useRef, useState } from 'react'
import { paletteFor } from '../../../shared/art'
import { FileGlyph } from '../icons'
import { useMediaSound } from '../state/mediaVolume'
import Empty from './Empty'
import MediaBar from './MediaBar'
import Cover from './music/Cover'
import Spinner from './Spinner'

const COVER = 320

// A track or a clip standing where the words of a file would be. Nothing starts
// on its own: a file somebody opened is a file to look at, and an agent showing
// one is no reason for a room to fill with sound.
//
// A track has no picture, so it is given one: the same photographed petals a
// song wears, seeded by the file's own path, so the same file is the same
// picture on everyone's screen and two of them are told apart at a glance.
//
// Where it has got to is read every frame rather than off the element's own
// four-a-second word about it, since a bar that steps is a bar that reads as
// stuck.
export default function MediaView({ path, src, video }: { path: string; src: string; video: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [at, setAt] = useState(0)
  const [length, setLength] = useState(0)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [near, setNear] = useState(false)
  const sound = useMediaSound()

  useEffect(() => {
    setPlaying(false)
    setAt(0)
    setLength(0)
    setReady(false)
    setFailed(false)
  }, [src])

  useEffect(() => {
    const element = ref.current
    if (!element) return
    element.volume = sound.volume
    element.muted = sound.muted
  }, [sound, ready])

  useEffect(() => {
    if (!playing) return
    let frame = requestAnimationFrame(function tick() {
      const element = ref.current
      if (element) setAt(element.currentTime)
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [playing])

  const toggle = () => {
    const element = ref.current
    if (!element || failed) return
    if (element.paused) {
      void element.play().catch(() => {
        if (element.error) setFailed(true)
      })
    } else element.pause()
  }

  const seek = (seconds: number) => {
    const element = ref.current
    if (!element || !length) return
    element.currentTime = Math.min(length, Math.max(0, seconds))
    setAt(element.currentTime)
  }

  const measure = () => {
    const element = ref.current
    if (!element) return
    if (Number.isFinite(element.duration)) setLength(element.duration)
    setReady(true)
  }

  return (
    <div
      className="absolute inset-0 bg-ink-900"
      onPointerEnter={() => setNear(true)}
      onPointerLeave={() => setNear(false)}
    >
      {!failed && !video && (
        <div className="absolute inset-0 flex items-center justify-center p-6 pb-24">
          <div className="w-full" style={{ maxWidth: COVER }}>
            <Cover
              item={{ id: path, colors: paletteFor(path) }}
              size={COVER}
              playing={playing}
              className="w-full aspect-square rounded-card"
            />
          </div>
        </div>
      )}

      <video
        ref={ref}
        src={src}
        preload="metadata"
        onLoadedMetadata={measure}
        onDurationChange={measure}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setFailed(true)}
        onClick={video ? toggle : undefined}
        aria-label={path}
        className={
          video && !failed
            ? 'absolute inset-0 w-full h-full object-contain animate-rise'
            : 'sr-only'
        }
      />

      {!failed && !ready && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner size={20} className="text-fg-muted" />
        </div>
      )}

      {failed && (
        <Empty icon={<FileGlyph className="w-8 h-8 text-fg-faint" />} label="This file will not play" detail={path} />
      )}

      {!failed && ready && (!video || !playing || near) && (
        <MediaBar playing={playing} at={at} length={length} onToggle={toggle} onSeek={seek} />
      )}
    </div>
  )
}
