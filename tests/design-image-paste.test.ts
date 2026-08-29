import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTLStore, defaultBindingUtils, Editor } from '../src/renderer/src/canvas'
import { designShapeUtils } from '../src/renderer/src/design/shapeUtils'
import { pasteImages, readImageSize } from '../src/renderer/src/design/pasteImages'

const editors: Editor[] = []

function board(): Editor {
  const editor = new Editor({
    store: createTLStore({ shapeUtils: designShapeUtils, bindingUtils: defaultBindingUtils }),
    shapeUtils: designShapeUtils,
    bindingUtils: defaultBindingUtils,
    getContainer: () => document.body
  })
  editor.setViewportScreenBounds({ x: 0, y: 0, w: 1000, h: 700 })
  editors.push(editor)
  return editor
}

describe('images pasted into Design', () => {
  afterEach(() => {
    for (const editor of editors.splice(0)) editor.dispose()
  })

  it('uploads the file and creates a selected image at the viewport center', async () => {
    const editor = board()
    const file = new File(['pixels'], 'room.png', { type: 'image/png' })
    const upload = vi.fn(async () => 'http://127.0.0.1:7331/attachments/room.png')

    const [id] = await pasteImages(editor, [file], 'http://127.0.0.1:7331', {
      readSize: async () => ({ w: 320, h: 180 }),
      upload
    })

    const shape = editor.getShape(id)!
    const asset = editor.getAsset((shape.props as { assetId: string }).assetId)!
    expect(upload).toHaveBeenCalledWith('http://127.0.0.1:7331', file)
    expect(shape).toMatchObject({ type: 'image', x: 340, y: 260, props: { w: 320, h: 180 } })
    expect(asset).toMatchObject({
      type: 'image',
      props: {
        w: 320,
        h: 180,
        name: 'room.png',
        mimeType: 'image/png',
        src: 'http://127.0.0.1:7331/attachments/room.png'
      }
    })
    expect(editor.getSelectedShapeIds()).toEqual([id])
  })

  it('reads browser image dimensions and releases the bitmap', async () => {
    const close = vi.fn()
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 144, height: 96, close }))
    )
    const file = new File(['pixels'], 'shot.png', { type: 'image/png' })
    await expect(readImageSize(file)).resolves.toEqual({ w: 144, h: 96 })
    expect(close).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })
})
