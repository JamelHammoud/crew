import { useEffect, useState } from 'react'

// Every slot has a track from the moment the connection does, and it starts out
// carrying nothing. This is the difference between a camera that is on and a
// camera whose pictures have actually turned up, which is what decides whether
// a tile shows video or the person's face.
export function useLive(stream: MediaStream | null, wanted: boolean): boolean {
  const [live, setLive] = useState(false)

  useEffect(() => {
    const track = wanted ? (stream?.getVideoTracks?.() ?? [])[0] : undefined
    if (!track) {
      setLive(false)
      return
    }
    const read = (): void => setLive(!track.muted && track.readyState === 'live')
    read()
    track.addEventListener('mute', read)
    track.addEventListener('unmute', read)
    track.addEventListener('ended', read)
    return () => {
      track.removeEventListener('mute', read)
      track.removeEventListener('unmute', read)
      track.removeEventListener('ended', read)
    }
  }, [stream, wanted])

  return live
}
