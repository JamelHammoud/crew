import { useLayoutEffect, useRef } from 'react'

export default function Skeleton({ className = 'h-full w-full' }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    for (const anim of ref.current?.getAnimations?.({ subtree: true }) ?? []) anim.startTime = 0
  }, [])

  return <span ref={ref} aria-hidden data-skeleton className={`skeleton block ${className}`} />
}
