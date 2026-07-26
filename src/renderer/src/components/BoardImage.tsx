import { useEffect, useRef, useState } from 'react'
import { TldrawImage, type TLStoreSnapshot } from 'tldraw'
import 'tldraw/tldraw.css'
import type { DesignDocument } from '../../../shared/design'
import { designShapeUtils } from '../design/shapeUtils'
import Skeleton from './Skeleton'

export default function BoardImage({ document }: { document: DesignDocument }) {
  const host = useRef<HTMLDivElement>(null)
  const [painted, setPainted] = useState(false)

  useEffect(() => {
    const box = host.current
    if (!box) return
    const found = (): boolean => {
      const image = box.querySelector('img')
      if (!image) return false
      if (image.complete) setPainted(true)
      else image.addEventListener('load', () => setPainted(true), { once: true })
      return true
    }
    if (found()) return
    const watch = new MutationObserver(() => {
      if (found()) watch.disconnect()
    })
    watch.observe(box, { childList: true, subtree: true })
    return () => watch.disconnect()
  }, [])

  return (
    <div ref={host} className="relative h-full w-full">
      {!painted && <Skeleton className="absolute inset-0" />}
      <TldrawImage
        snapshot={{ store: document.store, schema: document.schema } as unknown as TLStoreSnapshot}
        shapeUtils={designShapeUtils}
        format="svg"
        background={false}
        darkMode={false}
        padding={24}
        preserveAspectRatio="xMidYMid meet"
      />
    </div>
  )
}
