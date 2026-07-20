export default function Avatar({ name }: { name: string }) {
  return (
    <span className="w-7 h-7 rounded-full bg-zinc-800 text-zinc-300 text-xs font-medium flex items-center justify-center shrink-0">
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}
