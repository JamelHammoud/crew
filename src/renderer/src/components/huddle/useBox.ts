import { useCallback, useRef, useState } from 'react'

export interface Box {
  width: number
  height: number
}

// Measures the element it is attached to and keeps measuring as it changes, so
// a layout can be worked out in pixels rather than guessed at in fractions.
export function useBox(): [(node: HTMLDivElement | null) => void, Box] {
  const [box, setBox] = useState<Box>({ width: 0, height: 0 })
  const watcher = useRef<ResizeObserver | null>(null)

  const attach = useCallback((node: HTMLDivElement | null) => {
    watcher.current?.disconnect()
    watcher.current = null
    if (!node) return
    const read = (): void => setBox({ width: node.clientWidth, height: node.clientHeight })
    read()
    if (typeof ResizeObserver === 'undefined') return
    watcher.current = new ResizeObserver(read)
    watcher.current.observe(node)
  }, [])

  return [attach, box]
}
