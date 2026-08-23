import { writeFile } from 'node:fs/promises'
import { interpolate } from 'flubber'
import { svgPathProperties } from 'svg-path-properties'
import { morphDrawing } from '../src/renderer/src/components/agentMorph'
import { petOf } from '../src/renderer/src/components/art/pet'
import type { AgentActivity } from '../src/renderer/src/components/agentActivity'

const ring = (path: string): Array<[number, number]> => {
  const geometry = new svgPathProperties(path)
  const length = geometry.getTotalLength()
  return Array.from({ length: 64 }, (_, index) => {
    const point = geometry.getPointAtLength((length * index) / 64)
    return [point.x, point.y]
  })
}

const pairs: Array<[AgentActivity, AgentActivity]> = [
  ['idle', 'reading'],
  ['reading', 'designing'],
  ['designing', 'running'],
  ['running', 'planning'],
  ['planning', 'communicating']
]
const stops = [0, 0.2, 0.4, 0.6, 0.8, 1]
const pet = petOf('motion-morph')
const cells = pairs.flatMap(([from, to], row) => {
  const source = morphDrawing(from, pet)
  const target = morphDrawing(to, pet)
  const starts = [source.body, ...source.features]
  const ends = [target.body, ...target.features]
  const mixers = starts.map((start, index) =>
    interpolate(ring(start), ring(ends[index]), { maxSegmentLength: Number.POSITIVE_INFINITY })
  )
  return stops.map((stop, column) => {
    const x = 24 + column * 142
    const y = 44 + row * 142
    return `<g transform="translate(${x} ${y})"><rect width="112" height="112" rx="20" fill="#17171b"/><g transform="translate(6 6)"><path d="${mixers[0](stop)}" fill="#f4f4f5"/><path d="${mixers[1](stop)}" fill="#17171b"/><path d="${mixers[2](stop)}" fill="#17171b"/><path d="${mixers[3](stop)}" fill="#17171b"/></g><text x="56" y="130" text-anchor="middle" fill="#a1a1aa" font-family="system-ui" font-size="11">${Math.round(stop * 100)}%</text></g>`
  })
})

const labels = pairs.map(
  ([from, to], row) =>
    `<text x="880" y="${100 + row * 142}" fill="#f4f4f5" font-family="system-ui" font-size="14">${from} → ${to}</text>`
)

await writeFile(
  '/tmp/crew-morph-frames.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="1040" height="760" viewBox="0 0 1040 760"><rect width="1040" height="760" fill="#0b0b0d"/>${cells.join('')}${labels.join('')}</svg>`
)
