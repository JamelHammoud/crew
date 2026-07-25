import { Children, type ReactNode } from 'react'

export default function FaceStack({
  face,
  gap = 3,
  children
}: {
  face: number
  gap?: number
  children: ReactNode
}) {
  const faces = Children.toArray(children)
  if (faces.length === 0) return null

  const step = Math.round(face * 0.68)
  const radius = face / 2
  const bite = `radial-gradient(circle ${radius + gap}px at ${step + radius}px ${radius}px, transparent 99%, #000 100%)`

  return (
    <span className="inline-flex shrink-0">
      {faces.map((child, index) => {
        const cut = index < faces.length - 1
        return (
          <span
            key={index}
            className="block shrink-0"
            style={{
              width: face,
              height: face,
              marginLeft: index === 0 ? 0 : step - face,
              maskImage: cut ? bite : undefined,
              WebkitMaskImage: cut ? bite : undefined
            }}
          >
            {child}
          </span>
        )
      })}
    </span>
  )
}
