import type { Editor, TLShapeId } from '../canvas'
import { AssetRecordType, createShapeId, type TLAsset } from '../canvas/schema'
import { uploadImage } from '../components/images'

interface ImageSize {
  w: number
  h: number
}

interface PasteImageDependencies {
  readSize?: (file: File) => Promise<ImageSize>
  upload?: (httpBase: string, file: File) => Promise<string>
}

function imageElementSize(file: File): Promise<ImageSize> {
  return new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(src)
      resolve({ w: image.naturalWidth, h: image.naturalHeight })
    }
    image.onerror = () => {
      URL.revokeObjectURL(src)
      reject(new Error('Could not read image'))
    }
    image.src = src
  })
}

export async function readImageSize(file: File): Promise<ImageSize> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      const size = { w: bitmap.width, h: bitmap.height }
      bitmap.close()
      if (size.w > 0 && size.h > 0) return size
    } catch {}
  }
  const size = await imageElementSize(file)
  if (size.w < 1 || size.h < 1) throw new Error('Could not read image')
  return size
}

export async function pasteImages(
  editor: Editor,
  files: File[],
  httpBase: string,
  dependencies: PasteImageDependencies = {}
): Promise<TLShapeId[]> {
  if (files.length === 0) return []
  const sizeOf = dependencies.readSize ?? readImageSize
  const save = dependencies.upload ?? uploadImage
  const images = await Promise.all(
    files.map(async file => {
      const [size, src] = await Promise.all([sizeOf(file), save(httpBase, file)])
      if (size.w < 1 || size.h < 1) throw new Error('Could not read image')
      return { file, size, src }
    })
  )
  const center = editor.getViewportPageCenter()
  const ids = images.map(() => createShapeId())
  editor.run(() => {
    editor.markHistoryStoppingPoint('paste image')
    images.forEach(({ file, size, src }, index) => {
      const asset = AssetRecordType.create({
        id: `asset:${crypto.randomUUID()}`,
        type: 'image',
        props: {
          w: size.w,
          h: size.h,
          name: file.name || 'Pasted image',
          isAnimated: file.type === 'image/gif',
          mimeType: file.type || null,
          src,
          ...(file.size > 0 ? { fileSize: file.size } : {})
        }
      }) as TLAsset<'image'>
      editor.store.put([asset])
      editor.createShape({
        id: ids[index],
        type: 'image',
        x: center.x - size.w / 2 + index * 24,
        y: center.y - size.h / 2 + index * 24,
        props: { assetId: asset.id, w: size.w, h: size.h }
      })
    })
    editor.setSelectedShapes(ids)
  })
  return ids
}
