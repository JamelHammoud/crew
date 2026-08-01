import { describe, expect, it } from 'vitest'
import { BASE_TYPE, cleanType, type TypeStyle } from '../src/shared/designNode'
import {
  FALLBACK_FACE,
  PROBE_SIZE,
  fontShorthand,
  measureTextLayout,
  readFaceMetrics,
  resolveLineHeight,
  trimEdges,
  trimStyle,
  trimmedHeight,
  type TextMeasurer,
  type TrimFont
} from '../src/renderer/src/canvas/text'

const HELLO = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }]
} as const

const CAP = FALLBACK_FACE.cap
const ASCENT = FALLBACK_FACE.ascent
const DESCENT = FALLBACK_FACE.descent

function font(size: number, lineHeight: number): TrimFont {
  return { fontFamily: 'Inter', fontSize: size, fontStyle: 'normal', fontWeight: '400', lineHeight }
}

function lines(count: number, linePx: number): TextMeasurer {
  return { measureHtml: () => ({ w: 120, h: count * linePx }) }
}

function layOut(type: TypeStyle, count: number) {
  const linePx = resolveLineHeight(type.size, type.lineHeight)
  return measureTextLayout(lines(count, linePx), {
    richText: HELLO as never,
    autoSize: true,
    width: 0,
    fontSize: type.size,
    options: {
      fontFamily: 'Inter',
      fontStyle: 'normal',
      fontWeight: '400',
      lineHeight: type.lineHeight,
      padding: '0px'
    },
    trim: trimEdges(font(type.size, type.lineHeight), type.trim)
  })
}

describe('what a trim is worked out from', () => {
  it('reads the ascent, the descent and the cap height off real TextMetrics', () => {
    const ink = {
      fontBoundingBoxAscent: 97,
      fontBoundingBoxDescent: 21,
      actualBoundingBoxAscent: 70.458984375
    } as TextMetrics

    expect(readFaceMetrics(ink, PROBE_SIZE)).toEqual({ ascent: 0.97, descent: 0.21, cap: 0.70458984375 })
  })

  it('refuses a face it could not measure rather than trimming by a guess', () => {
    const whole = { fontBoundingBoxAscent: 97, fontBoundingBoxDescent: 21, actualBoundingBoxAscent: 70 }
    expect(readFaceMetrics({ ...whole, actualBoundingBoxAscent: 0 } as TextMetrics, PROBE_SIZE)).toBeNull()
    expect(readFaceMetrics({ ...whole, fontBoundingBoxAscent: NaN } as TextMetrics, PROBE_SIZE)).toBeNull()
    expect(readFaceMetrics({ ...whole, actualBoundingBoxAscent: undefined } as unknown as TextMetrics, PROBE_SIZE)).toBeNull()
  })

  it('keys a face by its family, its weight and its slant, so two faces are two measurements', () => {
    const upright = fontShorthand(font(24, 1.5), PROBE_SIZE)
    const heavy = fontShorthand({ ...font(24, 1.5), fontWeight: '700' }, PROBE_SIZE)
    const slanted = fontShorthand({ ...font(24, 1.5), fontStyle: 'italic' }, PROBE_SIZE)

    expect(upright).toBe('normal 400 100px Inter')
    expect(new Set([upright, heavy, slanted]).size).toBe(3)
  })

  it('takes the whole of the leading off, the half above the cap and the half under the baseline', () => {
    const trim = trimEdges(font(100, 1.5), 'cap')!

    expect(resolveLineHeight(100, 1.5)).toBe(150)
    expect(trim.cap).toBeCloseTo(70.5, 10)
    expect(trim.top).toBeCloseTo((150 - 118) / 2 + 97 - 70.5, 10)
    expect(trim.bottom).toBeCloseTo((150 - 118) / 2 + 21, 10)
    expect(trim.top + trim.bottom).toBeCloseTo(trim.total, 10)
    expect(trim.total).toBeCloseTo(150 - 70.5, 10)
  })

  it('is the line box less the cap height, whatever the line height is', () => {
    for (const lineHeight of [1, 1.2, 1.35, 1.5, 2, 3]) {
      const trim = trimEdges(font(24, lineHeight), 'cap')!
      expect(trim.total).toBeCloseTo(resolveLineHeight(24, lineHeight) - 24 * CAP, 10)
    }
  })

  it('is nothing at all when nothing was asked for', () => {
    expect(trimEdges(font(100, 1.5), 'none')).toBeNull()
  })
})

describe('a box that has been trimmed', () => {
  const trimmed: TypeStyle = { ...BASE_TYPE, size: 100, lineHeight: 1.5, trim: 'cap' }
  const plain: TypeStyle = { ...trimmed, trim: 'none' }

  it('is shorter than an untrimmed one by exactly the leading, and hugs the cap on one line', () => {
    const trim = trimEdges(font(100, 1.5), 'cap')!

    expect(layOut(plain, 1).height).toBe(150)
    expect(layOut(trimmed, 1).height).toBeCloseTo(70.5, 10)
    expect(layOut(plain, 1).height - layOut(trimmed, 1).height).toBeCloseTo(trim.total, 10)
    expect(layOut(plain, 1).height - layOut(trimmed, 1).height).toBeCloseTo(79.5, 10)
  })

  it('keeps every line gap between the lines and only takes the outer leading', () => {
    const trim = trimEdges(font(100, 1.5), 'cap')!
    for (const count of [1, 2, 3, 7]) {
      expect(layOut(plain, count).height).toBe(count * 150)
      expect(layOut(trimmed, count).height).toBeCloseTo((count - 1) * 150 + 70.5, 10)
      expect(layOut(plain, count).height - layOut(trimmed, count).height).toBeCloseTo(trim.total, 10)
    }
  })

  it('never comes out under one cap height, however tight the line height is', () => {
    const tight = trimEdges(font(100, 0.5), 'cap')!
    expect(resolveLineHeight(100, 0.5)).toBe(50)
    expect(tight.total).toBeCloseTo(50 - 70.5, 10)
    expect(trimmedHeight(50, tight)).toBeCloseTo(70.5, 10)
  })

  it('is the width the untrimmed box was, so the trim is vertical and nothing else', () => {
    expect(layOut(trimmed, 2).width).toBe(layOut(plain, 2).width)
  })
})

describe('measuring and painting agree', () => {
  it('lifts the paint by the same top the measurement took off, scale and all', () => {
    const trim = trimEdges(font(100, 1.5), 'cap')!

    expect(trimStyle(trim, 1)).toEqual({ marginTop: -trim.top })
    expect(trimStyle(trim, 2)).toEqual({ marginTop: -trim.top * 2 })
    expect(trimStyle(null, 1)).toEqual({})
  })

  it('leaves the cap sitting on the top edge and the baseline on the bottom edge', () => {
    const size = 100
    const trim = trimEdges(font(size, 1.5), 'cap')!
    const painted = trimStyle(trim, 1) as { marginTop: number }
    const leading = (resolveLineHeight(size, 1.5) - (ASCENT + DESCENT) * size) / 2
    const capFromTop = leading + ASCENT * size - CAP * size

    expect(capFromTop + painted.marginTop).toBeCloseTo(0, 10)
    expect(trimmedHeight(resolveLineHeight(size, 1.5), trim)).toBeCloseTo(CAP * size, 10)
  })
})

describe('a trim through the record', () => {
  it('reads a board written before the field existed as untrimmed', () => {
    const older = { family: 'Lora', size: 18, lineHeight: 1.4 }

    expect(cleanType(older)?.trim).toBe('none')
    expect(BASE_TYPE.trim).toBe('none')
    expect(layOut({ ...BASE_TYPE, ...older, trim: 'none' } as TypeStyle, 1).height).toBe(resolveLineHeight(18, 1.4))
  })

  it('keeps the value it was given across a round trip, and turns anything else into none', () => {
    const kept = cleanType({ ...BASE_TYPE, trim: 'cap' })
    expect(kept?.trim).toBe('cap')
    expect(cleanType(JSON.parse(JSON.stringify(kept)))?.trim).toBe('cap')

    for (const value of ['standard', 'both', 'CAP', '', undefined, null, 0, {}]) {
      expect(cleanType({ ...BASE_TYPE, trim: value })?.trim).toBe('none')
    }
  })

  it('changes nothing about a board that never asked for it', () => {
    const untouched = cleanType({ ...BASE_TYPE, size: 32, lineHeight: 1.25 }) as TypeStyle
    expect(untouched.trim).toBe('none')
    expect(layOut(untouched, 3).height).toBe(3 * resolveLineHeight(32, 1.25))
  })
})

describe('the trim leaves the rest of the type alone', () => {
  it('reads the same line height the untrimmed box was laid out on', () => {
    for (const lineHeight of [1, 1.35, 2]) {
      const plain = layOut({ ...BASE_TYPE, size: 40, lineHeight, trim: 'none' }, 2)
      const trimmed = layOut({ ...BASE_TYPE, size: 40, lineHeight, trim: 'cap' }, 2)
      expect(plain.height - trimmed.height).toBeCloseTo(resolveLineHeight(40, lineHeight) - 40 * CAP, 10)
    }
  })

  it('is worked out from the face, so the letter spacing rides through untouched', () => {
    const spaced = cleanType({ ...BASE_TYPE, trim: 'cap', spacing: 12 })
    expect(spaced?.spacing).toBe(12)
    expect(spaced?.trim).toBe('cap')
    expect(trimEdges(font(40, 1.5), 'cap')).toEqual(trimEdges(font(40, 1.5), 'cap'))
  })

  it('falls back to a real face rather than to nothing when it cannot measure one', () => {
    expect(CAP).toBeGreaterThan(0)
    expect(ASCENT + DESCENT).toBeGreaterThan(CAP)
    expect(trimEdges(font(100, 1.5), 'cap')!.total).toBeCloseTo(150 - CAP * 100, 10)
  })
})
