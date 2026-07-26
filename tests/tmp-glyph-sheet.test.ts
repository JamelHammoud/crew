import { writeFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it } from 'vitest'
import * as glyphs from '../src/renderer/src/components/toolGlyphs'

describe('sheet', () => {
  it('draws every glyph', () => {
    const entries = Object.entries(glyphs)
    const cols = 6
    const cell = 120
    const rows = Math.ceil(entries.length / cols)
    const parts = entries.map(([name, Icon], index) => {
      const x = (index % cols) * cell
      const y = Math.floor(index / cols) * cell
      const svg = renderToStaticMarkup(createElement(Icon as never, { className: '' }))
      const big = svg.replace('<svg', `<svg width="48" height="48" x="${x + 36}" y="${y + 24}"`)
      const small = svg.replace('<svg', `<svg width="16" height="16" x="${x + 52}" y="${y + 78}"`)
      return `${big}${small}<text x="${x + 60}" y="${y + 110}" fill="#707070" font-size="9" font-family="sans-serif" text-anchor="middle">${name.replace('Glyph', '')}</text>`
    })
    const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cell}" height="${rows * cell}" viewBox="0 0 ${cols * cell} ${rows * cell}"><rect width="100%" height="100%" fill="#141414"/><g color="#b3b3b3">${parts.join('')}</g></svg>`
    writeFileSync('/tmp/crew-glyphs.svg', sheet)
  })
})
