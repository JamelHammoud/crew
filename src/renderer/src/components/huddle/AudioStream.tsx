import { useEffect, useRef } from 'react'

// Remote voices need an element to come out of, and it never needs to be seen.
export default function AudioStream({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || el.srcObject === stream) return
    el.srcObject = stream
    void el.play().catch(() => {})
  }, [stream])

  return <audio ref={ref} autoPlay className="hidden" />
}
