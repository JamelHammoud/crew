import type { DesignNodeProps } from '../../../shared/designNode'

declare module '@tldraw/tlschema' {
  interface TLGlobalShapePropsMap {
    'design-node': DesignNodeProps
  }
}
