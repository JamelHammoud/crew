export default function Counts({
  added,
  removed,
  size = 'xs'
}: {
  added: number
  removed: number
  size?: 'xs' | 'sm'
}) {
  if (!added && !removed) return null
  return (
    <span className={`shrink-0 font-mono ${size === 'sm' ? 'text-sm' : 'text-xs'}`}>
      {added > 0 && <span className="text-positive">+{added}</span>}
      {added > 0 && removed > 0 && ' '}
      {removed > 0 && <span className="text-danger">−{removed}</span>}
    </span>
  )
}
