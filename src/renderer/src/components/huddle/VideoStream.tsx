import { useEffect, useRef } from 'react'

export default function VideoStream({
  stream,
  mirror,
  contain,
  className = ''
}: {
  stream: MediaStream
  mirror?: boolean
  contain?: boolean
  className?: string
}) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || el.srcObject === stream) return
    el.srcObject = stream
    void el.play().catch(() => {})
  }, [stream])

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
