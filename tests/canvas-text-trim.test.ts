import { describe, expect, it } from 'vitest'
import { BASE_TYPE, cleanType, type TypeStyle } from '../src/shared/designNode'
import {
  FALLBACK_METRICS,
  fontShorthand,
  readFontMetrics,
  resolveLineHeight,
  trimOf,
  trimStyle,
  trimmedHeight,
  measureTextLayout,
  type FontMetrics,
  type TextMeasurer
} from '../src/renderer/src/canvas/text'

const SYSTEM: FontMetrics = { ascent: 0.97, descent: 0.21, capHeight: 0.7046 }

const HELLO = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }]
} as const

function lines(count: number, lineHeightPx: number): TextMeasurer {
  return { measureHtml: () => ({ w: 120, h: count * lineHeightPx }) }
}

function layOut(type: TypeStyle, count: number, trim: ReturnType<typeof trimOf> | null) {
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
    trim
  })
}

describe('what a trim is worked out from', () => {
  it('reads the ascent, the descent and the cap height off real TextMetrics', () => {
    const full = { fontBoundingBoxAscent: 97, fontBoundingBoxDescent: 21 } as TextMetrics
    const cap = { actualBoundingBoxAscent: 70.458984375 } as TextMetrics

    expect(readFontMetrics(full, cap, 100)).toEqual({
      ascent: 0.97,
      descent: 0.21,
      capHeight: 0.70458984375
    })
  })

  it('refuses a face it could not measure rather than trimming by a guess', () => {
    const cap = { actualBoundingBoxAscent: 70 } as TextMetrics
    expect(readFontMetrics({ fontBoundingBoxAscent: 0, fontBoundingBoxDescent: 21 } as TextMetrics, cap, 100)).toBeNull()
    expect(
      readFontMetrics({ fontBoundingBoxAscent: NaN, fontBoundingBoxDescent: 21 } as TextMetrics, cap, 100)
    ).toBeNull()
    expect(
      readFontMetrics(
        { fontBoundingBoxAscent: 97, fontBoundingBoxDescent: 21 } as TextMetrics,
        { actualBoundingBoxAscent: 0 } as TextMetrics,
        100
      )
    ).toBeNull()
  })

  it('keys a face by its family, its weight and its slant, so two faces are two measurements', () => {
    expect(fontShorthand('Inter', 400, false, 100)).toBe('400 100px Inter')
    expect(fontShorthand('Inter', 700, true, 100)).toBe('italic 700 100px Inter')
    expect(fontShorthand('Inter', 400, false, 100)).not.toBe(fontShorthand('Inter', 700, false, 100))
  })

  it('takes the whole of the leading off, the half above the cap and the half under the baseline', () => {
    const trim = trimOf(SYSTEM, 100, 1.5)

    expect(resolveLineHeight(100, 1.5)).toBe(150)
    expect(trim.cap).toBeCloseTo(70.46, 6)
    expect(trim.top).toBeCloseTo(16 + 97 - 70.46, 6)
    expect(trim.bottom).toBeCloseTo(16 + 21, 6)
    expect(trim.top + trim.bottom).toBeCloseTo(trim.total, 10)
    expect(trim.total).toBeCloseTo(150 - 70.46, 6)
  })

  it('is the line box less the cap height, whatever the line height is', () => {
    for (const lineHeight of [1, 1.2, 1.35, 1.5, 2, 3]) {
      const trim = trimOf(SYSTEM, 24, lineHeight)
      expect(trim.total).toBeCloseTo(resolveLineHeight(24, lineHeight) - 24 * SYSTEM.capHeight, 10)
    }
  })
})

describe('a box that has been trimmed', () => {
  const type: TypeStyle = { ...BASE_TYPE, size: 100, lineHeight: 1.5, trim: 'cap' }

  it('is shorter than an untrimmed one by exactly the leading, and hugs the cap on one line', () => {
    const trim = trimOf(SYSTEM, type.size, type.lineHeight)
    const plain = layOut(type, 1, null)
    const trimmed = layOut(type, 1, trim)

    expect(plain.height).toBe(150)
    expect(trimmed.height).toBeCloseTo(70.46, 6)
    expect(plain.height - trimmed.height).toBeCloseTo(trim.total, 6)
    expect(plain.height - trimmed.height).toBeCloseTo(150 - 70.46, 6)
  })

  it('keeps every line gap between the lines and only takes the outer leading', () => {
    const trim = trimOf(SYSTEM, type.size, type.lineHeight)
    for (const count of [1, 2, 3, 7]) {
      const plain = layOut(type, count, null)
      const trimmed = layOut(type, count, trim)
      expect(plain.height).toBe(count * 150)
      expect(trimmed.height).toBeCloseTo((count - 1) * 150 + 70.46, 6)
      expect(plain.height - trimmed.height).toBeCloseTo(trim.total, 6)
    }
  })

  it('never comes out under one cap height, however tight the line height is', () => {
    const tight = trimOf(SYSTEM, 100, 0.5)
    expect(resolveLineHeight(100, 0.5)).toBe(50)
    expect(tight.total).toBeCloseTo(50 - 70.46, 6)
    expect(trimmedHeight(50, tight)).toBeCloseTo(70.46, 6)
  })

  it('is the width the untrimmed box was, so the trim is vertical and nothing else', () => {
    const trim = trimOf(SYSTEM, type.size, type.lineHeight)
    expect(layOut(type, 2, trim).width).toBe(layOut(type, 2, null).width)
  })
})

describe('measuring and painting agree', () => {
  it('lifts the paint by the same top the measurement took off, scale and all', () => {
    const trim = trimOf(SYSTEM, 100, 1.5)

    expect(trimStyle(trim, 1)).toEqual({ marginTop: -trim.top })
    expect(trimStyle(trim, 2)).toEqual({ marginTop: -trim.top * 2 })
    expect(trimStyle(null, 1)).toEqual({})
  })

  it('leaves the cap sitting on the top edge and the baseline on the bottom edge', () => {
    const size = 100
    const trim = trimOf(SYSTEM, size, 1.5)
    const painted = trimStyle(trim, 1) as { marginTop: number }
    const box = trimmedHeight(resolveLineHeight(size, 1.5), trim)

    const capTop = SYSTEM.ascent * size - SYSTEM.capHeight * size + (150 - (SYSTEM.ascent + SYSTEM.descent) * size) / 2
    expect(capTop + painted.marginTop).toBeCloseTo(0, 10)
    expect(box).toBeCloseTo(SYSTEM.capHeight * size, 10)
  })
})

describe('a trim through the record', () => {
  it('reads a board written before the field existed as untrimmed', () => {
    const older = { family: 'Lora', size: 18, lineHeight: 1.4 }
    const clean = cleanType(older)

    expect(clean?.trim).toBe('none')
    expect(BASE_TYPE.trim).toBe('none')
    expect(trimOf(SYSTEM, 18, 1.4).total).not.toBe(0)
    expect(layOut({ ...BASE_TYPE, ...older, trim: 'none' } as TypeStyle, 1, null).height).toBe(
      resolveLineHeight(18, 1.4)
    )
  })

  it('keeps the value it was given across a round trip, and turns anything else into none', () => {
    const trimmed = cleanType({ ...BASE_TYPE, trim: 'cap' })
    expect(trimmed?.trim).toBe('cap')
    expect(cleanType(JSON.parse(JSON.stringify(trimmed)))?.trim).toBe('cap')

    expect(cleanType({ ...BASE_TYPE, trim: 'standard' })?.trim).toBe('none')
    expect(cleanType({ ...BASE_TYPE, trim: 'both' })?.trim).toBe('none')
    expect(cleanType({ ...BASE_TYPE, trim: undefined })?.trim).toBe('none')
    expect(cleanType({ ...BASE_TYPE, trim: null })?.trim).toBe('none')
  })

  it('changes nothing about a board that never asked for it', () => {
    const untrimmed = cleanType({ ...BASE_TYPE, size: 32, lineHeight: 1.25 }) as TypeStyle
    expect(untrimmed.trim).toBe('none')
    expect(layOut(untrimmed, 3, null).height).toBe(3 * resolveLineHeight(32, 1.25))
  })
})

describe('the trim leaves the rest of the type alone', () => {
  it('reads the same line height the untrimmed box was laid out on', () => {
    for (const lineHeight of [1, 1.35, 2]) {
      const trim = trimOf(SYSTEM, 40, lineHeight)
      const plain = layOut({ ...BASE_TYPE, size: 40, lineHeight }, 2, null)
      const trimmed = layOut({ ...BASE_TYPE, size: 40, lineHeight, trim: 'cap' }, 2, trim)
      expect(plain.height - trimmed.height).toBeCloseTo(resolveLineHeight(40, lineHeight) - 40 * SYSTEM.capHeight, 6)
    }
  })

  it('is worked out from the face and never from the letter spacing', () => {
    const wide = trimOf(SYSTEM, 40, 1.5)
    const tight = trimOf(SYSTEM, 40, 1.5)
    expect(wide).toEqual(tight)
    expect(cleanType({ ...BASE_TYPE, trim: 'cap', spacing: 12 })?.spacing).toBe(12)
    expect(cleanType({ ...BASE_TYPE, trim: 'cap', spacing: 12 })?.trim).toBe('cap')
  })

  it('falls back to a real face rather than to nothing when it cannot measure one', () => {
    expect(FALLBACK_METRICS.capHeight).toBeGreaterThan(0)
    expect(FALLBACK_METRICS.ascent + FALLBACK_METRICS.descent).toBeGreaterThan(FALLBACK_METRICS.capHeight)
    expect(trimOf(FALLBACK_METRICS, 100, 1.5).total).toBeCloseTo(150 - 70.5, 6)
  })
})
