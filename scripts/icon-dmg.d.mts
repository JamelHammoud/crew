export type DmgGeometry = { bite: number; step: number }

export type DmgMark = {
  radius: number
  cut: number
  centres: number[]
  width: number
}

export const DMG: {
  width: number
  height: number
  iconSize: number
  line: number
  app: number
  applications: number
  headline: number
  at: number
}

export const TRAVEL: {
  from: number
  to: number
  radius: number
  glide: number
  wake: number
  still: number
}

export const DMG_DEFS: string

export const DMG_WASH: string

export const HEADLINE: string

export function dmgMark(geometry: DmgGeometry, radius?: number): DmgMark

export function markGroup(
  geometry: DmgGeometry,
  id: string,
  radius?: number
): { mark: DmgMark; masks: string; discs: string }

export function markAt(where: number): number

export function wakePath(geometry: DmgGeometry): string

export function dmgOverlay(geometry: DmgGeometry, where?: number): string

export function dmgDefs(geometry: DmgGeometry): string

export function dmgBackground(geometry: DmgGeometry, picture: string | null): string
