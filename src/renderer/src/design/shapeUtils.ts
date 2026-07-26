import { ArrowShapeUtil, defaultShapeUtils, GeoShapeUtil } from 'tldraw'
import { DesignNodeUtil } from './DesignNodeUtil'
import { DesignFrameUtil } from './FrameUtil'
import { DesignTextUtil } from './TextUtil'

const NO_OUTLINE = { showTextOutline: false }

const REPLACEMENTS: Record<string, (typeof defaultShapeUtils)[number]> = {
  frame: DesignFrameUtil,
  geo: GeoShapeUtil.configure(NO_OUTLINE),
  text: DesignTextUtil,
  arrow: ArrowShapeUtil.configure(NO_OUTLINE)
}

export const designShapeUtils = [
  ...defaultShapeUtils.map(util => REPLACEMENTS[util.type] ?? util),
  DesignNodeUtil
]
