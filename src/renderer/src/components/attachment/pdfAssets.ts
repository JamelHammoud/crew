const AT = 'pdfjs/'

export interface PdfAssets {
  cMapUrl: string
  iccUrl: string
  standardFontDataUrl: string
  wasmUrl: string
}

function at(dir: string, base: string): string {
  return new URL(`${AT}${dir}/`, base).href
}

export function pdfAssets(base: string = document.baseURI): PdfAssets {
  return {
    cMapUrl: at('cmaps', base),
    iccUrl: at('iccs', base),
    standardFontDataUrl: at('standard_fonts', base),
    wasmUrl: at('wasm', base)
  }
}
