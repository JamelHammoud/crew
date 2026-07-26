import { useEffect, useRef } from 'react'
import type { Box } from '../zoom'

export default function VideoStream({
  stream,
  mirror,
  contain,
  onSize,
  className = ''
}: {
  stream: MediaStream
  mirror?: boolean
  contain?: boolean
  onSize?: (box: Box) => void
  className?: string
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const last = useRef<Box | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || el.srcObject === stream) return
    el.srcObject = stream
    void el.play()?.catch(() => {})
  }, [stream])

  useEffect(() => {
    const el = ref.current
    if (!el || !onSize) return
    const read = (): void => {
      if (!el.videoWidth || !el.videoHeight) return
      const box = { width: el.videoWidth, height: el.videoHeight }
      if (last.current?.width === box.width && last.current?.height === box.height) return
      last.current = box
      onSize(box)
    }
    read()
    el.addEventListener('loadedmetadata', read)
    el.addEventListener('resize', read)
    return () => {
      el.removeEventListener('loadedmetadata', read)
      el.removeEventListener('resize', read)
    }
  }, [onSize, stream])

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className={`w-full h-full ${contain ? 'object-contain' : 'object-cover'} ${
        mirror ? 'scale-x-[-1]' : ''
      } ${className}`}
    />
  )
}
