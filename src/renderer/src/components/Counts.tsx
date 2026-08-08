// A mono figure reads larger than sans set at the same size, so a count
// standing in a row of sans is drawn a step under it rather than level with it
// on the ruler.
const SIZES = { beside: 'text-[10px]', xs: 'text-xs', sm: 'text-sm' } as const

export default function Counts({
  added,
  removed,
  size = 'xs',
  className = ''
}: {
  added: number
  removed: number
  size?: keyof typeof SIZES
  className?: string
}) {
  if (!added && !removed) return null
  return (
    <span className={`shrink-0 font-mono ${className} ${SIZES[size]}`}>
      {added > 0 && <span className="text-positive">+{added}</span>}
      {added > 0 && removed > 0 && ' '}
      {removed > 0 && <span className="text-danger">−{removed}</span>}
    </span>
  )
}
