import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useHeaderSlot, type HeaderPlace } from '../state/headerSlot'

export default function HeaderSlot({
  place = 'center',
  children
}: {
  place?: HeaderPlace
  children: ReactNode
}) {
  const node = useHeaderSlot(s => s.nodes[place])
  if (!node) return null
  return createPortal(children, node)
}
