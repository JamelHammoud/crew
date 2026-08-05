import { useMusic } from '../../state/music'
import VolumeButton from '../VolumeButton'
import { barButton } from './buttons'

// How loud it is where you are sitting, which is yours alone and is never sent
// anywhere. It stands beside the bar that says where the track is, so the one
// slider on the bar is the one everybody shares.
export default function Volume() {
  const volume = useMusic(s => s.volume)
  const muted = useMusic(s => s.muted)

  return (
    <VolumeButton
      volume={volume}
      muted={muted}
      className={`${barButton} w-7 h-7`}
      onVolume={level => useMusic.getState().setVolume(level)}
      onMuted={next => useMusic.getState().setMuted(next)}
    />
  )
}
