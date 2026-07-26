import type { ReactNode } from 'react'
import type { MusicItem } from '../../../../shared/music'
import { GRAIN, meshOf } from './mesh'

// The mesh is painted on a layer bigger than the tile and blurred, so the blur
// has somewhere to fall off to and the corners keep their color instead of
// fading to grey.
export default function Cover({
  item,
  playing = false,
  className = '',
  children
}: {
  item: MusicItem
  playing?: boolean
  className?: string
  children?: ReactNode
}) {
  return (
    <span className={`relative block overflow-hidden isolate ${className}`}>
      <span
        aria-hidden
        style={meshOf(item)}
        className={`absolute -inset-1/4 blur-xl ${playing ? 'animate-drift' : ''}`}
      />
      <span
        aria-hidden
        style={{ backgroundImage: GRAIN, backgroundSize: '160px 160px' }}
        className="absolute inset-0 opacity-[0.16] mix-blend-overlay"
      />
      <span aria-hidden className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-[inherit]" />
      {children}
    </span>
  )
}
