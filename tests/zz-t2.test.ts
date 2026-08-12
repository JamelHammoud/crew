import { createElement, type ReactNode } from 'react'
declare const R: (p: Record<string, unknown>) => ReactNode
const rows: ReactNode[] = []
for (let i = 0; i < 3; i++) {
  rows.push(createElement(R, { key: i, targetId: 't', authorId: 'a', authorName: 'A', label: 'L', text: 'x' }))
}
export { rows }
