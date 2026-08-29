export const STICKY_COLORS = ['default', 'yellow', 'pink', 'blue', 'green', 'purple'] as const

export type StickyColor = (typeof STICKY_COLORS)[number]

export interface Sticky {
  id: string
  title?: string
  body: string
  color: StickyColor
  pinned: boolean
  createdAt: number
  updatedAt: number
}

export interface CreateStickyInput {
  title?: string
  body: string
  color?: StickyColor
  pinned?: boolean
}

export interface UpdateStickyInput {
  title?: string
  body?: string
  color?: StickyColor
  pinned?: boolean
}
