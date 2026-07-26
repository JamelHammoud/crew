import { describe, expect, it } from 'vitest'
import { textBoxStyle, textStyle } from '../src/renderer/src/design/nodeCss'
import { FACES, SIZES, faceStyle, faceValue } from '../src/renderer/src/design/typeFaces'
import { BASE_TYPE, cleanType, type TypeStyle } from '../src/shared/designNode'

function typeOf(patch: Partial<TypeStyle>): TypeStyle {
  return { ...BASE_TYPE, ...patch }
}

describe('typography styles', () => {
  it('names every weight the way Figma does, upright and italic', () => {
    expect(FACES).toHaveLength(18)
    expect(FACES.find(face => face.value === '400')?.label).toBe('Regular')
    expect(FACES.find(face => face.value === '400i')?.label).toBe('Italic')
    expect(FACES.find(face => face.value === '600i')?.label).toBe('Semi Bold Italic')
    expect(FACES.find(face => face.value === '900')?.label).toBe('Black')
  })

  it('picks the name for a weight and gives the weight back', () => {
    expect(faceValue(typeOf({ weight: 700 }))).toBe('700')
    expect(faceValue(typeOf({ weight: 500, italic: true }))).toBe('500i')
    expect(faceStyle('700')).toEqual({ weight: 700, italic: false })
    expect(faceStyle('300i')).toEqual({ weight: 300, italic: true })
  })

  it('rounds an odd weight to the nearest name rather than dropping it', () => {
    expect(faceValue(typeOf({ weight: 460 }))).toBe('500')
    expect(faceValue(typeOf({ weight: 120 }))).toBe('100')
  })

  it('offers the sizes a type ramp is built from', () => {
    expect(SIZES).toContain(12)
    expect(SIZES).toContain(48)
    expect(SIZES.every((size, at) => at === 0 || size > SIZES[at - 1])).toBe(true)
  })

  it('renders case, decoration and italics as css', () => {
    const style = textStyle(typeOf({ transform: 'upper', decoration: 'strike', italic: true }))
    expect(style.textTransform).toBe('uppercase')
    expect(style.textDecoration).toBe('line-through')
    expect(style.fontStyle).toBe('italic')
    expect(textStyle(typeOf({ decoration: 'underline' })).textDecoration).toBe('underline')
    expect(textStyle(typeOf({})).textDecoration).toBe('none')
  })

  it('leaves the text box alone until it is asked to sit low', () => {
    expect(textBoxStyle(typeOf({ vertical: 'top' }))).toEqual({})
    expect(textBoxStyle(typeOf({ vertical: 'middle' })).justifyContent).toBe('center')
    expect(textBoxStyle(typeOf({ vertical: 'bottom' })).justifyContent).toBe('flex-end')
    expect(textBoxStyle(typeOf({ vertical: 'bottom' })).height).toBe('100%')
  })

  it('keeps a stored style that predates the new fields', () => {
    const stored = cleanType({ family: 'serif', size: 20, weight: 600, color: '#101010' })
    expect(stored?.vertical).toBe('top')
    expect(stored?.decoration).toBe('none')
    expect(stored?.size).toBe(20)
  })
})
