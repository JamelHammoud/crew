import { SignalIcon } from '@heroicons/react/16/solid'

// The mark for a call that is happening right now. It breathes, so a still
// screenshot and a live window do not look the same.
export default function Live({ size = 'w-4 h-4' }: { size?: string }) {
  return (
    <span className="relative shrink-0 flex items-center justify-center">
      <span className="absolute inset-[-4px] rounded-full bg-positive/15 animate-pulse" />
      <SignalIcon className={`relative text-positive ${size}`} />
    </span>
  )
}
