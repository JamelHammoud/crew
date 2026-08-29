import { createElement, type ReactNode } from 'react'
import { Ellipse2d, Rectangle2d } from '../geometry'
import { createShapeId, imageShapeProps, type TLAsset as CrewAsset, type TLShape as CrewShape } from '../schema'
import { BaseBoxShapeUtil, type CrewShapePartial } from './ShapeUtil'

export type ImageShape = CrewShape<'image'>

export class ImageShapeUtil extends BaseBoxShapeUtil<ImageShape> {
  static override type = 'image' as const
  static override props = imageShapeProps
  static override handledAssetTypes = ['image'] as const

  getDefaultProps(): ImageShape['props'] {
    return {
      w: 100,
      h: 100,
      assetId: null,
      playing: true,
      url: '',
      crop: null,
      flipX: false,
      flipY: false,
      altText: ''
    }
  }
  override canCrop(): boolean {
    return true
  }
  override isAspectRatioLocked(): boolean {
    return true
  }
  override isExportBoundsContainer(): boolean {
    return true
  }
  override getAriaDescriptor(shape: ImageShape): string {
    return shape.props.altText
  }

  createShapeForAsset(asset: CrewAsset, position: { x: number; y: number }): CrewShapePartial<ImageShape> | null {
    if (asset.type !== 'image') return null
    return {
      id: createShapeId(),
      type: 'image',
      x: position.x,
      y: position.y,
      opacity: 1,
      props: { assetId: asset.id, w: asset.props.w, h: asset.props.h }
    }
  }

  getGeometry(shape: ImageShape) {
    return shape.props.crop?.isCircle
      ? new Ellipse2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
      : new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  component(shape: ImageShape): ReactNode {
    const asset = shape.props.assetId ? this.editor.getAsset?.(shape.props.assetId) : undefined
    const rawSource = asset?.type === 'image' ? asset.props.src : null
    const source = rawSource ? (this.editor.resolveAssetUrl?.(rawSource) ?? rawSource) : null
    const crop = shape.props.crop
    const left = crop ? crop.topLeft.x * 100 : 0
    const top = crop ? crop.topLeft.y * 100 : 0
    const width = crop ? 100 / Math.max(0.0001, crop.bottomRight.x - crop.topLeft.x) : 100
    const height = crop ? 100 / Math.max(0.0001, crop.bottomRight.y - crop.topLeft.y) : 100
    return createElement(
      'div',
      {
        style: {
          position: 'relative',
          width: shape.props.w,
          height: shape.props.h,
          overflow: 'hidden',
          borderRadius: crop?.isCircle ? '50%' : undefined,
          pointerEvents: 'all'
        }
      },
      source
        ? createElement('img', {
            src: source,
            alt: shape.props.altText,
            draggable: false,
            style: {
              position: 'absolute',
              width: `${width}%`,
              height: `${height}%`,
              left: `${(-left * width) / 100}%`,
              top: `${(-top * height) / 100}%`,
              objectFit: 'fill',
              transform: `scale(${shape.props.flipX ? -1 : 1}, ${shape.props.flipY ? -1 : 1})`
            }
          })
        : createElement('div', { style: { width: '100%', height: '100%', background: 'rgba(127,127,127,.15)' } })
    )
  }
}
