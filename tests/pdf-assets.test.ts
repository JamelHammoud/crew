import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import pdfjsAssets, { PDFJS_AT, PDFJS_DIRS, pdfjsFiles, pdfjsRoot } from '../pdfjs-assets'
import { pdfAssets } from '../src/renderer/src/components/attachment/pdfAssets'

const PARAMS = ['cMapUrl', 'iccUrl', 'standardFontDataUrl', 'wasmUrl'] as const

const served = (): ((url: string) => Promise<{ type?: string; body?: Buffer; passed: boolean }>) => {
  let handler: ((req: unknown, res: unknown, next: () => void) => void) | null = null
  const plugin = pdfjsAssets()
  const configure = plugin.configureServer
  if (typeof configure !== 'function') throw new Error('no configureServer')
  configure.call(
    {} as never,
    {
      middlewares: {
        use: (fn: never) => {
          handler = fn
        }
      }
    } as never
  )
  return url =>
    new Promise(resolve => {
      const headers: Record<string, string> = {}
      handler?.(
        { url },
        {
          setHeader: (name: string, value: string) => {
            headers[name.toLowerCase()] = value
          },
          end: (body: Buffer) => resolve({ type: headers['content-type'], body, passed: false })
        },
        () => resolve({ passed: true })
      )
    })
}

describe('the files pdfjs reads for itself', () => {
  it('names four directories the installed pdfjs really has', async () => {
    for (const dir of PDFJS_DIRS) {
      const found = await stat(path.join(pdfjsRoot(), dir))
      expect(found.isDirectory(), dir).toBe(true)
    }
  })

  it('asks for every parameter pdfjs still takes', async () => {
    const types = await readFile(path.join(pdfjsRoot(), 'types/src/display/api.d.ts'), 'utf8')
    for (const param of PARAMS) expect(types).toContain(`${param}?:`)
  })

  it('hands one url per parameter, each a folder', () => {
    const assets = pdfAssets('http://localhost:5173/index.html')
    expect(Object.keys(assets).sort()).toEqual([...PARAMS].sort())
    for (const url of Object.values(assets)) {
      expect(url.startsWith(`http://localhost:5173/${PDFJS_AT}`)).toBe(true)
      expect(url.endsWith('/')).toBe(true)
    }
  })

  it('stands beside the page rather than at the root of it', () => {
    const assets = pdfAssets('file:///Apps/Crew.app/out/renderer/index.html')
    expect(assets.standardFontDataUrl).toBe('file:///Apps/Crew.app/out/renderer/pdfjs/standard_fonts/')
  })

  it('lists a file from each directory', async () => {
    const files = await pdfjsFiles()
    for (const dir of PDFJS_DIRS) {
      expect(
        files.some(name => name.startsWith(`${dir}/`)),
        dir
      ).toBe(true)
    }
  })

  it('serves a standard font and the wasm it is asked for', async () => {
    const serve = served()
    const font = await serve('/pdfjs/standard_fonts/LiberationSans-Regular.ttf')
    expect(font.passed).toBe(false)
    expect(font.body?.length).toBeGreaterThan(0)
    const wasm = await serve('/pdfjs/wasm/openjpeg.wasm')
    expect(wasm.type).toBe('application/wasm')
    expect(wasm.body?.subarray(0, 4).toString('latin1')).toBe('\0asm')
  })

  it('passes over anything outside those directories', async () => {
    const serve = served()
    expect((await serve('/pdfjs/../package.json')).passed).toBe(true)
    expect((await serve('/pdfjs/build/pdf.mjs')).passed).toBe(true)
    expect((await serve('/attachments/a.pdf')).passed).toBe(true)
  })
})
