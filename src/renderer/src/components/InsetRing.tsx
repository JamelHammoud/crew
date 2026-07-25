// A ring drawn inside the box it marks, on top of whatever fills it. Rings that
// sit outside the box get cut off the moment the box lands in a scroller or a
// card that clips, and the mark for who is talking has to survive both.
export default function InsetRing({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`absolute inset-0 rounded-[inherit] pointer-events-none ${className}`}
    />
  )
}
