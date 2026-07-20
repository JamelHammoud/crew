const SIZES = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base'
} as const

function hueOf(name: string): number {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360
  return hash
}

export default function Avatar({ name, size = 'md' }: { name: string; size?: keyof typeof SIZES }) {
  const hue = hueOf(name.trim().toLowerCase())
  return (
    <span
      className={`${SIZES[size]} rounded-full font-semibold flex items-center justify-center shrink-0 select-none`}
      style={{
        backgroundColor: `oklch(0.32 0.045 ${hue})`,
        color: `oklch(0.87 0.06 ${hue})`
      }}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}
