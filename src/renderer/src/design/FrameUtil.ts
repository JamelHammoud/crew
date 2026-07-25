import { FrameShapeUtil, type TLFrameShape } from 'tldraw'
import { frameBackground, frameStroke } from './frameFill'

export const DesignFrameUtil = FrameShapeUtil.configure({
  getCustomDisplayValues(_editor, shape: TLFrameShape) {
    const fill = frameBackground(shape.meta)
    return { fillColor: fill, strokeColor: frameStroke(fill) }
  }
})
