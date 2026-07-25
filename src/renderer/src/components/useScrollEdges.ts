import { RefObject, useEffect, useState } from 'react'

export default function useScrollEdges(ref: RefObject<HTMLElement | null>) {
  const [edges, setEdges] = useState({ top: true, bottom: true })

  const update = () => {
    const el = ref.current
    if (!el) return
    const top = el.scrollTop < 2
    const bottom = el.scrollTop + el.clientHeight > el.scrollHeight - 2
    setEdges(prev => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }))
  }

  useEffect(update)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.addEventListener('scroll', update)
    return () => el.removeEventListener('scroll', update)
  }, [ref])

  return { edges, update }
}
