import { useMusic } from '../../state/music'
import Levels from '../Levels'

// The music's own loudness. Where it is playing this is a real analyser, and
// where it is not it is the same curve worked out of the notes themselves, so a
// machine with the sound turned off watches what everyone else watches.
export default function Bars({
  count,
  className = '',
  barClassName = ''
}: {
  count: number
  className?: string
  barClassName?: string
}) {
  return (
    <Levels
      count={count}
      read={(bands, out) => useMusic.getState().levels(bands, out)}
      className={className}
      barClassName={barClassName}
    />
  )
}
