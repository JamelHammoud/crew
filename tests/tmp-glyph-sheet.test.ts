import { writeFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it } from 'vitest'
import { toolAction } from '../src/renderer/src/components/toolActions'
import * as glyphs from '../src/renderer/src/components/toolGlyphs'

const SANS = 'system-ui, -apple-system, sans-serif'
const MONO = 'SF Mono, Menlo, monospace'
const INK900 = '#141414'
const INK850 = '#1a1a1a'
const INK800 = '#222222'
const INK700 = '#272727'
const FG = '#ffffff'
const FG2 = '#b3b3b3'
const MUTED = '#707070'
const FAINT = '#4a4a4a'
const GOOD = '#4ade80'
const BAD = '#f87171'

const mark = (name: string, x: number, y: number, color: string, size = 18): string => {
  const action = toolAction(name)
  return renderToStaticMarkup(createElement(action.icon as never, { className: '' }))
    .replace('<svg', `<svg width="${size}" height="${size}" x="${x}" y="${y}"`)
    .replace('currentColor', color)
}

const text = (s: string, x: number, y: number, fill: string, size = 13, font = SANS): string =>
  `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-family="${font}">${s.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`

const wide = (s: string, size = 13): number => s.length * (size === 13 ? 7.1 : 6.1)

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
      const small = svg.replace('<svg', `<svg width="18" height="18" x="${x + 51}" y="${y + 78}"`)
      return `${big}${small}<text x="${x + 60}" y="${y + 110}" fill="${MUTED}" font-size="9" font-family="${SANS}" text-anchor="middle">${name.replace('Glyph', '')}</text>`
    })
    const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cell}" height="${rows * cell}" viewBox="0 0 ${cols * cell} ${rows * cell}"><rect width="100%" height="100%" fill="${INK900}"/><g color="${FG2}">${parts.join('')}</g></svg>`
    writeFileSync('/tmp/crew-glyphs.svg', sheet)
  })

  it('draws a run of steps, a folded group, and an opened diff', () => {
    const out: string[] = []
    const x = 24
    let y = 24
    const step = (name: string, subject: string, counts: [number, number] | null, live = false): void => {
      const action = toolAction(name)
      const label = live ? action.run : action.done
      out.push(mark(name, x, y, live ? FG : MUTED))
      out.push(text(label, x + 28, y + 13.5, live ? FG2 : MUTED))
      let at = x + 28 + wide(label) + 10
      if (subject) {
        out.push(text(subject, at, y + 13, FAINT, 11, action.prose ? SANS : MONO))
        at += wide(subject, 11) + 10
      }
      if (counts) {
        out.push(text(`+${counts[0]}`, at, y + 13, GOOD, 11, MONO))
        out.push(text(`−${counts[1]}`, at + wide(`+${counts[0]} `, 11), y + 13, BAD, 11, MONO))
      }
      y += 30
    }
    const chevron = (at: number, top: number, open: boolean): string =>
      `<path d="${open ? 'm-4 -2 4 4 4-4' : 'm-2 -4 4 4-4 4'}" transform="translate(${at},${top})" fill="none" stroke="${FAINT}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`

    step('TodoWrite', 'Drawing the rows', null)
    step('Grep', 'AgentIcon', null)
    step('Bash', 'yarn vitest run tests/tool-actions-probe.test.ts', null)

    out.push(mark('Edit', x, y, MUTED))
    out.push(text('Edited files', x + 28, y + 13.5, MUTED))
    out.push(text('+28', x + 28 + wide('Edited files') + 10, y + 13, GOOD, 11, MONO))
    out.push(text('−18', x + 28 + wide('Edited files') + 10 + 26, y + 13, BAD, 11, MONO))
    out.push(chevron(x + 28 + wide('Edited files') + 78, y + 9, true))
    y += 30

    const edited: Array<[string, [number, number]]> = [
      ['toolActions.ts', [6, 3]],
      ['StepRow.tsx', [7, 11]],
      ['StepGroup.tsx', [9, 0]],
      ['ThreadItems.tsx', [6, 4]]
    ]
    for (const [file, counts] of edited) {
      out.push(mark('Edit', x, y, MUTED))
      out.push(text('Edited', x + 28, y + 13.5, MUTED))
      out.push(text(file, x + 28 + wide('Edited') + 10, y + 13, FAINT, 11, MONO))
      const at = x + 28 + wide('Edited') + 10 + wide(file, 11) + 10
      out.push(text(`+${counts[0]}`, at, y + 13, GOOD, 11, MONO))
      out.push(text(`−${counts[1]}`, at + 26, y + 13, BAD, 11, MONO))
      y += 30
    }

    out.push(mark('Edit', x, y, MUTED))
    out.push(text('Edited', x + 28, y + 13.5, MUTED))
    out.push(text('StepRow.tsx', x + 28 + wide('Edited') + 10, y + 13, FAINT, 11, MONO))
    out.push(chevron(x + 28 + wide('Edited') + 10 + wide('StepRow.tsx', 11) + 76, y + 9, true))
    y += 26

    const cardX = x + 26
    const cardW = 560
    const lines: Array<[string, 'gone' | 'new' | 'same']> = [
      ['function Marker({ running }: { running: boolean }) {', 'gone'],
      ['  if (running) return <Spinner size={12} />', 'gone'],
      ['function Mark({ icon: Icon, running }: MarkProps) {', 'new'],
      ['  return <Icon className={running ? live : rest} />', 'new'],
      ['}', 'same']
    ]
    const head = 28
    const rowH = 20
    const cardH = head + lines.length * rowH + 12
    out.push(
      `<rect x="${cardX}" y="${y}" width="${cardW}" height="${cardH}" rx="12" fill="${INK850}" stroke="${INK700}"/>`,
      `<path d="M${cardX} ${y + 12}a12 12 0 0 1 12-12h${cardW - 24}a12 12 0 0 1 12 12v${head - 12}H${cardX}Z" fill="${INK800}"/>`,
      text('src/renderer/src/components/StepRow.tsx', cardX + 12, y + 18, FG2, 11, MONO),
      text('+7', cardX + 12 + wide('src/renderer/src/components/StepRow.tsx', 11) + 10, y + 18, GOOD, 11, MONO),
      text('−11', cardX + 12 + wide('src/renderer/src/components/StepRow.tsx', 11) + 36, y + 18, BAD, 11, MONO),
      mark('Glob', cardX + cardW - 27, y + 6, FAINT, 15)
    )
    lines.forEach(([code, kind], index) => {
      const top = y + head + 6 + index * rowH
      if (kind !== 'same') {
        out.push(
          `<rect x="${cardX + 1}" y="${top}" width="${cardW - 2}" height="${rowH}" fill="${kind === 'gone' ? BAD : GOOD}" fill-opacity="0.1"/>`
        )
      }
      out.push(
        text(kind === 'gone' ? '−' : kind === 'new' ? '+' : '', cardX + 12, top + 14, kind === 'gone' ? BAD : GOOD, 11, MONO),
        text(code, cardX + 30, top + 14, kind === 'gone' ? MUTED : FG2, 11, MONO)
      )
    })
    y += cardH + 14

    const width = 660
    const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${y}" viewBox="0 0 ${width} ${y}"><rect width="100%" height="100%" fill="${INK900}"/>${out.join('')}</svg>`
    writeFileSync('/tmp/crew-rows.svg', sheet)
  })
})
