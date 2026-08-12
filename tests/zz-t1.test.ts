import { createElement, type ReactNode } from 'react'
declare const R: (p: Record<string, unknown>) => ReactNode
export const x = Array.from({ length: 3 }, (_, i) => createElement(R, { key: i, text: 'x' }))
