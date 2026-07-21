import { useLayoutEffect, useRef } from 'react'

export default function Spinner({ size = 18, className = '' }: { size?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    // CSS animations start at mount, so spinners drift out of phase with each
    // other. Pinning startTime to 0 on the shared document timeline keeps
    // every instance rotating in lockstep.
    for (const anim of ref.current?.getAnimations() ?? []) anim.startTime = 0
  }, [])

  return (
    <span
      ref={ref}
      role="status"
      aria-label="Working"
      className={`inline-block shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      style={{ width: size, height: size, animationDuration: '0.8s' }}
    />
  )
}
