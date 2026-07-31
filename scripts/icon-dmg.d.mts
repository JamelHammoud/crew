export type DmgGeometry = { bite: number; step: number }

export type DmgDisc = {
  x: number
  y: number
  r: number
  o: number
  cut: { x: number; r: number } | null
}

export const DMG: {
  width: number
  height: number
  iconSize: number
  line: number
  app: number
  applications: number
  headline: number
  cover: string
}

export const DMG_COVERS: string[]

export const DMG_DEFS: string

export const DMG_WASH: string

export const DMG_GRAIN: string

export const HEADLINE: string

export function dmgDiscs(geometry: DmgGeometry): DmgDisc[]

export function dmgOverlay(
  geometry: DmgGeometry,
  prefix?: string
): { masks: string; drawn: string }

export function dmgBackground(geometry: DmgGeometry, cover: string | null): string
