import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

// So many lines of something, and a fade where it was cut. An ellipsis cannot
// do this job: what somebody wrote has blank lines in it, a blank line is a line
// like any other to a clamp, and the cut lands on one often enough that the
// preview ends in a row with nothing on it but three dots. The fade is drawn
// only where there is really more underneath, so a short message ends where it
// ends rather than dissolving for no reason.
export default function Clamped({
  lines,
  watch,
  className = '',
  children
}: {
  lines: number
  watch?: unknown
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [cut, setCut] = useState(false)

  useLayoutEffect(() => {
    const box = ref.current
    if (!box) return
    const read = () => setCut(box.scrollHeight - box.clientHeight > 1)
    read()
    const watching = new ResizeObserver(read)
    watching.observe(box)
    return () => watching.disconnect()
  }, [lines, watch])

  return (
    <div ref={ref} style={{ maxHeight: `${lines}lh` }} className={`relative overflow-hidden ${className}`}>
      {children}
      {cut && (
        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-ink-900 to-transparent pointer-events-none" />
      )}
    </div>
  )
}
