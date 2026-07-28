import type { VoiceCard } from '../../../../shared/voice'

// What the agent drew while it was talking. Things worth looking at rather than
// hearing: the numbers off a run, the handful of names it found, the two ways
// it could go. A card is never the words said beside it written down again.

function Title({ children }: { children: string }) {
  return <h3 className="text-sm font-semibold text-fg mb-2.5">{children}</h3>
}

function Facts({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <dl className="space-y-2">
      {rows.map((row, index) => (
        <div key={index} className="flex items-baseline justify-between gap-4">
          <dt className="text-sm text-fg-muted truncate">{row.label}</dt>
          <dd className="text-base font-semibold text-fg tabular-nums shrink-0">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Items({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2.5 text-sm text-fg-secondary">
          <span className="mt-[7px] w-1 h-1 rounded-full bg-fg-faint shrink-0" />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  )
}

function Choice({ options, onPick }: { options: string[]; onPick: (option: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(option => (
        <button
          key={option}
          onClick={() => onPick(option)}
          className="h-9 px-4 rounded-full bg-fg/10 text-sm font-semibold text-fg transition-all duration-150 hover:bg-fg/20 active:scale-95"
        >
          {option}
        </button>
      ))}
    </div>
  )
}

export function VoiceCardView({ card, onPick }: { card: VoiceCard; onPick: (option: string) => void }) {
  return (
    <div className="bg-ink-800 rounded-card p-4 animate-rise">
      {card.title && <Title>{card.title}</Title>}
      {card.kind === 'facts' && <Facts rows={card.rows} />}
      {card.kind === 'list' && <Items items={card.items} />}
      {card.kind === 'choice' && <Choice options={card.options} onPick={onPick} />}
      {card.kind === 'note' && <p className="text-sm text-fg-secondary whitespace-pre-wrap">{card.text}</p>}
      {card.kind === 'code' && (
        <pre className="text-xs font-mono text-fg-secondary whitespace-pre-wrap break-words overflow-x-auto">
          {card.text}
        </pre>
      )}
    </div>
  )
}

export default function VoiceCards({ cards, onPick }: { cards: VoiceCard[]; onPick: (option: string) => void }) {
  if (cards.length === 0) return null
  return (
    <div className="w-full max-w-[420px] space-y-2.5">
      {cards.map((card, index) => (
        <VoiceCardView key={index} card={card} onPick={onPick} />
      ))}
    </div>
  )
}
