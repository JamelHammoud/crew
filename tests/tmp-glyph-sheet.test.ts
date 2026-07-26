import { writeFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it } from 'vitest'
import { toolAction } from '../src/renderer/src/components/toolActions'
import * as glyphs from '../src/renderer/src/components/toolGlyphs'

const SANS = 'system-ui, -apple-system, sans-serif'
const MONO = 'SF Mono, Menlo, monospace'

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
      return `${big}${small}<text x="${x + 60}" y="${y + 110}" fill="#707070" font-size="9" font-family="${SANS}" text-anchor="middle">${name.replace('Glyph', '')}</text>`
    })
    const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cell}" height="${rows * cell}" viewBox="0 0 ${cols * cell} ${rows * cell}"><rect width="100%" height="100%" fill="#141414"/><g color="#b3b3b3">${parts.join('')}</g></svg>`
    writeFileSync('/tmp/crew-glyphs.svg', sheet)
  })

  it('draws the rows as they land in a thread', () => {
    const run: Array<[string, string, boolean]> = [
      ['TodoWrite', 'Drawing the rows', false],
      ['Grep', 'AgentIcon', false],
      ['Read', 'src/renderer/src/components/StepRow.tsx', false],
      ['Glob', '12 files', false],
      ['Edit', 'src/renderer/src/components/toolActions.ts', false],
      ['Bash', 'yarn vitest run tests/tool-actions-probe.test.ts', false],
      ['WebSearch', 'heroicons outline tool icons', false],
      ['mcp__figma__get_design_context', 'node 12:408', false],
      ['Task', 'Sweep the renderer for raw tool names', false],
      ['Write', 'src/renderer/src/components/toolGlyphs.tsx', true]
    ]
    const gap = 30
    const top = 26
    const width = 560
    const parts = run.map(([name, subject, live], index) => {
      const action = toolAction(name)
      const y = top + index * gap
      const svg = renderToStaticMarkup(createElement(action.icon as never, { className: '' }))
      const mark = svg
        .replace('<svg', `<svg width="16" height="16" x="24" y="${y - 8}"`)
        .replace('currentColor', live ? '#ffffff' : '#707070')
      const label = `<text x="50" y="${y + 4.5}" fill="${live ? '#b3b3b3' : '#707070'}" font-size="13" font-family="${SANS}">${live ? action.run : action.done}</text>`
      const width = (live ? action.run : action.done).length * 7.1
      const detail = `<text x="${54 + width}" y="${y + 4}" fill="#4a4a4a" font-size="11" font-family="${action.prose ? SANS : MONO}">${subject}</text>`
      return mark + label + detail
    })
    const height = top + run.length * gap + 16
    const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#141414"/>${parts.join('')}</svg>`
    writeFileSync('/tmp/crew-rows.svg', sheet)
  })
})
