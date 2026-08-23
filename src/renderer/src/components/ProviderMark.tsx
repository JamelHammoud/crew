import { ServerGlyph, STROKE, wearWeight } from '../icons'
import claudeMark from '../media/providers/claude.png'
import codexMark from '../media/providers/codex.png'
import geminiMark from '../media/providers/gemini.png'
import grokMark from '../media/providers/grok.png'
import kimiMark from '../media/providers/kimi.png'
import ollamaMark from '../media/providers/ollama.png'
import InsetRing from './InsetRing'

const MARKS: Record<string, string> = {
  claude: claudeMark,
  codex: codexMark,
  kimi: kimiMark,
  grok: grokMark,
  gemini: geminiMark,
  local: ollamaMark
}

// A vendor wears its own app icon, which is the one place in the app that draws
// a picture nobody here made, and it is there because a mark somebody knows off
// their own dock says which model is about to run better than a word does. A
// server somebody wrote down themselves has no such mark to wear, so that one is
// Crew speaking for itself and it takes Crew's own drawing of a server. It was a
// generated field before, a different photograph for every address, which said
// the addresses were different from each other where the only thing worth saying
// is that none of them is a vendor.
export default function ProviderMark({ provider, className = 'w-4 h-4' }: { provider: string; className?: string }) {
  const src = MARKS[provider]
  return (
    <span className={`relative shrink-0 overflow-hidden rounded-[22%] ${className}`}>
      {src ? (
        <img src={src} alt="" draggable={false} className="w-full h-full object-cover" />
      ) : (
        <span className="absolute inset-0 bg-fg/[0.08] text-fg/70">
          <ServerGlyph className="block w-full h-full" strokeWidth={wearWeight(STROKE, className)} />
        </span>
      )}
      <InsetRing className="ring-1 ring-inset ring-fg/5" />
    </span>
  )
}
