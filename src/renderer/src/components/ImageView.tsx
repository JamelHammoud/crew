import { useCallback, useRef, useState } from 'react'
import ZoomView from './ZoomView'

const PIXELATED_AT = 3

export default function ImageView({ src, alt }: { src: string; alt: string }) {
  const imageRef = useRef<HTMLImageElement>(null)
  const [loaded, setLoaded] = useState(0)

  const content = useCallback(() => {
    const image = imageRef.current
    if (!image?.naturalWidth) return null
    return {
      box: { width: image.offsetWidth, height: image.offsetHeight },
      natural: image.naturalWidth
    }
  }, [loaded])

  return (
    <div data-image-frame className="absolute inset-0">
      <ZoomView content={content} refit={src} className="w-full h-full p-6 animate-rise">
        {({ scale, ratio }) => (
          <img
            ref={imageRef}
            src={src}
            alt={alt}
            draggable={false}
            onLoad={() => setLoaded(count => count + 1)}
            style={{ imageRendering: scale * ratio >= PIXELATED_AT ? 'pixelated' : undefined }}
            className={`max-w-full max-h-full object-contain select-none ${scale > 1 ? '' : 'rounded-card'}`}
          />
        )}
      </ZoomView>
    </div>
  )
}
