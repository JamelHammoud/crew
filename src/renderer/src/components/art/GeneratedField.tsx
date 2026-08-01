import { useEffect, useMemo, useRef, useState } from 'react'
import { paletteFor } from '../../../../shared/art'
import { coverFor } from './coverArt'
import { GRAIN, meshOf } from './mesh'

// The field a generated mark stands on: the same scene the covers are
// photographed in, worked out from a seed and seen through whatever shape it is
// handed. An agent's face and a helper's mark are the same picture in two
// silhouettes, so it is written once here rather than twice in the two.

// Under this the shader is not worth what it buys. A row of faces is a dozen
// marks, the picture is drawn at 512 and cached per id, and a wall of them on
// the first paint of a panel costs more than the difference can be seen. The
// mesh underneath is the same palette laid out the same way, so what it stands
// down to is the picture blurred rather than a colour.
export const WORTH_DRAWING = 40

export default function GeneratedField({
  seed,
  box,
  clip,
  light,
  className = ''
}: {
  seed: string
  // The size it is really drawn at, which the picture is sampled and the mesh is
  // blurred against. Both have to be a share of the box rather than a number of
  // pixels, or one size of the same mark is a picture and another is a wash.
  box: number
  // The silhouette, as a clip path. Left out, it fills whatever box it is given.
  clip?: string
  // How much light the scene carries, for a shape that stands on it in white.
  // Left out it is the picture as the covers are photographed, which is what a
  // mark seen through its own silhouette wears.
  light?: number
  className?: string
}) {
  const tile = useRef<HTMLCanvasElement>(null)
  const [drawn, setDrawn] = useState(box >= WORTH_DRAWING)
  const subject = useMemo(() => ({ id: seed, colors: paletteFor(seed) }), [seed])

  useEffect(() => {
    if (box < WORTH_DRAWING) {
      setDrawn(false)
      return
    }
    const canvas = tile.current
    if (!canvas) return
    const art = coverFor(subject)
    if (!art) {
      setDrawn(false)
      return
    }
    const grid = Math.round(box * Math.min(3, window.devicePixelRatio || 1))
    canvas.width = grid
    canvas.height = grid
    const flat = canvas.getContext('2d')
    if (!flat) return
    flat.drawImage(art, 0, 0, grid, grid)
    setDrawn(true)
  }, [subject, box])

  // Taken off the picture rather than laid over it as an ink. What is wanted is
  // the same scene under less light, which keeps every color in it and its
  // relation to the others, where a black scrim is a grey film that flattens the
  // palette it covers.
  const shade = light === undefined ? '' : ` brightness(${light})`
  const wash = (): Mesh => {
    const mesh = meshOf(subject, box)
    return { ...mesh, filter: `${mesh.filter}${shade}` }
  }

  return (
    <span aria-hidden className={`absolute inset-0 ${className}`} style={clip ? { clipPath: clip } : undefined}>
      {drawn ? (
        <canvas
          ref={tile}
          style={shade ? { filter: shade.trimStart() } : undefined}
          className="absolute inset-0 w-full h-full"
        />
      ) : (
        <span style={wash()} className="absolute inset-0" />
      )}
      <span
        style={{ backgroundImage: GRAIN, backgroundSize: '160px 160px' }}
        className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
      />
    </span>
  )
}
