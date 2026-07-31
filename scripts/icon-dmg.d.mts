export const DMG: {
  width: number
  height: number
  iconSize: number
  line: number
  app: number
  applications: number
  headline: number
  chrome: number
  iconTextRoom: number
  at: number
}

export const ARROW: {
  from: number
  to: number
  head: number
  sweep: number
  weight: number
  glide: number
}

export const DMG_DEFS: string

export const DMG_WASH: string

export const HEADLINE: string

export function arrowAt(where: number): number

export function dmgArrow(where?: number): string

export function dmgDefs(): string

export function dmgBackground(picture: string | null): string
