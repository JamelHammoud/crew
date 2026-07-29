import { useCallback, useRef, useState, type MouseEvent } from 'react'
import { DuplicateGlyph } from '../icons'
import { MenuItem, Popover } from './Popover'
import ZoomView from './ZoomView'

const PIXELATED_AT = 3

export default function ImageView({ src, alt }: { src: string; alt: string }) {
  const imageRef = useRef<HTMLImageElement>(null)
  const [natural, setNatural] = useState(0)
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)

  const content = useCallback(() => {
    const image = imageRef.current
    if (!image || !natural) return null
    return { box: { width: image.offsetWidth, height: image.offsetHeight }, natural }
  }, [natural])

  const onContextMenu = (event: MouseEvent) => {
    event.preventDefault()
    setMenuAt({ x: event.clientX, y: event.clientY })
  }

  return (
    <div data-image-frame className="absolute inset-0" onContextMenu={onContextMenu}>
      <ZoomView content={content} refit={src} className="w-full h-full p-6 animate-rise">
        {({ scale, ratio }) => (
          <img
            ref={imageRef}
            src={src}
            alt={alt}
            draggable={false}
            onLoad={event => setNatural(event.currentTarget.naturalWidth)}
            style={{ imageRendering: scale * ratio >= PIXELATED_AT ? 'pixelated' : undefined }}
            className={`max-w-full max-h-full object-contain ${scale > 1 ? '' : 'rounded-card'}`}
          />
        )}
      </ZoomView>
      <Popover open={menuAt !== null} onClose={() => setMenuAt(null)} at={menuAt ?? undefined}>
        <MenuItem
          icon={<DuplicateGlyph />}
          label="Copy image"
          onClick={() => {
            setMenuAt(null)
            void window.crew.copyImage(src)
          }}
        />
      </Popover>
    </div>
  )
}
