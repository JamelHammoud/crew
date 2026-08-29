import { useMemo, useState } from 'react'
import { snapshotToSvg, svgDataUrl } from '../canvas/export'
import type { DesignDocument } from '../../../shared/design'
import { resolveDesignAssetSource } from '../design/assetSource'
import { useCrew } from '../state/store'
import Skeleton from './Skeleton'

export default function BoardImage({ document }: { document: DesignDocument }) {
  const [painted, setPainted] = useState<string | null>(null)
  const httpBase = useCrew(state => state.httpBase)
  const source = useMemo(() => {
    const svg = snapshotToSvg(
      { store: document.store, schema: document.schema },
      {
        background: false,
        darkMode: false,
        padding: 24,
        preserveAspectRatio: 'xMidYMid meet',
        resolveAssetUrl: value => resolveDesignAssetSource(httpBase, value)
      }
    )
    return svg ? svgDataUrl(svg) : null
  }, [document, httpBase])

  return (
    <div className="relative h-full w-full">
      {source && painted !== source && (
        <span className="absolute inset-0 z-10">
          <Skeleton />
        </span>
      )}
      {source && <img src={source} alt="" className="h-full w-full object-contain" onLoad={() => setPainted(source)} />}
    </div>
  )
}
