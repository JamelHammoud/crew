export default function Spinner({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Working"
      className={`inline-block shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      style={{ width: size, height: size, animationDuration: '0.8s' }}
    />
  )
}
