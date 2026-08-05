import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useHeaderSlot } from '../state/headerSlot'

export default function HeaderSlot({ children }: { children: ReactNode }) {
  const node = useHeaderSlot(s => s.node)
  if (!node) return null
  return createPortal(children, node)
}
