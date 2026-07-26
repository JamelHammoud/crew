import { writeFileSync } from 'node:fs'
import { it } from 'vitest'
const { DESIGN_CURSORS, applyToolCursor } = await import('../src/renderer/src/design/cursors')
it('sheet', () => {
  const held: Record<string, string> = {}
  const fake = { style: { setProperty: (n: string, v: string) => { held[n] = v } } } as unknown as HTMLElement
  applyToolCursor(fake, 'draw')
  const all: Record<string, string> = { ...(DESIGN_CURSORS as Record<string, string>), pencil: held['--tl-cursor-cross'] }
  const cells = Object.entries(all).map(([name, value], i) => {
    const raw = value.slice(value.indexOf('svg+xml,') + 8, value.lastIndexOf('")'))
    const hot = value.slice(value.lastIndexOf('") ') + 3).split(',')[0].split(' ').map(Number)
    const svg = raw.split('%23').join('#')
    const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '').split("id='drop'").join(`id='drop${i}'`).split('url(#drop)').join(`url(#drop${i})`)
    const x = 20 + (i % 4) * 120
    const y = 20 + Math.floor(i / 4) * 130
    return `<g transform='translate(${x} ${y})'><rect width='88' height='88' fill='#eee'/><g transform='scale(4)'>${inner}</g><circle cx='${hot[0] * 4}' cy='${hot[1] * 4}' r='2.5' fill='red'/><text x='0' y='104' font-size='11' font-family='sans-serif'>${name.replace('--tl-cursor-', '')}</text></g>`
  })
  const life = Object.entries(all).map(([name, value], i) => {
    const raw = value.slice(value.indexOf('svg+xml,') + 8, value.lastIndexOf('")')).split('%23').join('#')
    const inner = raw.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '').split("id='drop'").join(`id='drop1${i}'`).split('url(#drop)').join(`url(#drop1${i})`)
    return `<g transform='translate(${20 + i * 34} 300)'>${inner}</g>`
  })
  writeFileSync('/tmp/cursors.svg', `<svg xmlns='http://www.w3.org/2000/svg' width='500' height='340' viewBox='0 0 500 340'><rect width='500' height='340' fill='white'/>${cells.join('')}${life.join('')}</svg>`)
})
