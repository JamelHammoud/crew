import Avatar from '../../components/Avatar'
import TextField from '../../components/TextField'

// What everyone here will call you. Asked once, on the way in.
export default function YourName({
  name,
  first,
  onChange,
  onDone
}: {
  name: string
  first: boolean
  onChange: (name: string) => void
  onDone: () => void
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Avatar name={name.trim() || '?'} size="lg" />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-fg">{first ? 'What should we call you?' : 'Your name'}</h2>
          <p className="text-sm text-fg-muted mt-0.5">This is the name the crew sees.</p>
        </div>
      </div>
      <TextField
        autoFocus
        value={name}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && name.trim()) onDone()
        }}
        placeholder="Bobert"
      />
      <button
        onClick={onDone}
        disabled={!name.trim()}
        className="w-full h-12 rounded-full bg-fg text-ink-900 text-base font-semibold transition-all duration-150 hover:bg-fg/90 active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
      >
        {first ? 'Continue' : 'Done'}
      </button>
    </div>
  )
}
