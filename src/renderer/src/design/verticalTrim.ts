import type { TypeStyle } from '../../../shared/designNode'
import { cleanTrim, type VerticalTrim } from '../canvas/text/trim'

export interface TrimmedType extends TypeStyle {
  trim?: VerticalTrim
}

export function trimOf(type: Partial<TrimmedType>): VerticalTrim {
  return cleanTrim(type.trim)
}

export function withTrim<T extends object>(type: T, trim: VerticalTrim): T & { trim?: VerticalTrim } {
  return trim === 'cap' ? { ...type, trim } : type
}
