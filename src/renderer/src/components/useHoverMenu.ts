import { useCallback, useEffect, useRef, useState } from 'react'

export const REACH_MS = 220

const GAP = 6

export type Spot = { x: number; y: number }

export type HoverMenu = {
  open: boolean
  at: Spot | null
  show: () => void
  hold: () => void
  leave: () => void
  press: () => void
  close: () => void
}

export function useHoverMenu(row: { current: HTMLElement | null }): HoverMenu {
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState<Spot | null>(null)
  const pinned = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hold = useCallback(() => {
    if (timer.current === null) return
    clearTimeout(timer.current)
    timer.current = null
  }, [])

  const show = useCallback(() => {
    hold()
    const rect = row.current?.getBoundingClientRect()
    if (!rect) return
    setAt({ x: rect.right + GAP, y: rect.top - GAP })
    setOpen(true)
  }, [hold, row])

  const close = useCallback(() => {
    hold()
    pinned.current = false
    setOpen(false)
  }, [hold])

  const leave = useCallback(() => {
    if (pinned.current) return
    hold()
    timer.current = setTimeout(() => {
      timer.current = null
      setOpen(false)
    }, REACH_MS)
  }, [hold])

  const press = useCallback(() => {
    if (pinned.current) {
      close()
      return
    }
    show()
    pinned.current = true
  }, [close, show])

  useEffect(() => () => hold(), [hold])

  return { open, at, show, hold, leave, press, close }
}
