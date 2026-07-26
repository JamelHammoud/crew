import { TldrawImage, type TLStoreSnapshot } from 'tldraw'
import type { DesignDocument } from '../../../shared/design'
import { designShapeUtils } from '../design/shapeUtils'

export default function BoardImage({ document }: { document: DesignDocument }) {
  return (
    <TldrawImage
      snapshot={{ store: document.store, schema: document.schema } as unknown as TLStoreSnapshot}
      shapeUtils={designShapeUtils}
      format="svg"
      background={false}
      darkMode={false}
      padding={24}
      preserveAspectRatio="xMidYMid meet"
    />
  )
}
