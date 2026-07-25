import { ArrowShapeUtil, defaultShapeUtils, GeoShapeUtil, TextShapeUtil } from 'tldraw'
import { DesignNodeUtil } from './DesignNodeUtil'
import { DesignFrameUtil } from './FrameUtil'

const NO_OUTLINE = { showTextOutline: false }

const REPLACEMENTS: Record<string, (typeof defaultShapeUtils)[number]> = {
  frame: DesignFrameUtil,
  geo: GeoShapeUtil.configure(NO_OUTLINE),
  text: TextShapeUtil.configure(NO_OUTLINE),
  arrow: ArrowShapeUtil.configure(NO_OUTLINE)
}

export const designShapeUtils = [
  ...defaultShapeUtils.map(util => REPLACEMENTS[util.type] ?? util),
  DesignNodeUtil
]
