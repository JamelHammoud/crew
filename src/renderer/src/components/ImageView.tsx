import { useCallback, useRef, useState } from 'react'
import { useImageMenu } from './imageMenu'
import ZoomView from './ZoomView'

const PIXELATED_AT = 3

export default function ImageView({ src, alt, copyable = true }: { src: string; alt: string; copyable?: boolean }) {
  const imageRef = useRef<HTMLImageElement>(null)
  const [natural, setNatural] = useState(0)
  const { menu, onContextMenu } = useImageMenu(copyable ? src : undefined)

  const content = useCallback(() => {
    const image = imageRef.current
    if (!image || !natural) return null
    return { box: { width: image.offsetWidth, height: image.offsetHeight }, natural }
  }, [natural])

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
      {menu}
    </div>
  )
}
