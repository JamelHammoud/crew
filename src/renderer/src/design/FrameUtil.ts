import { FrameShapeUtil, type TLFrameShape } from '../canvas'
import { frameBackground, frameStroke } from './frameFill'

export const DesignFrameUtil = FrameShapeUtil.configure({
  getCustomDisplayValues(_editor: unknown, shape: TLFrameShape) {
    const fill = frameBackground(shape.meta)
    return { fillColor: fill, strokeColor: frameStroke(fill) }
  }
})
