import claudeMark from '../media/providers/claude.png'
import codexMark from '../media/providers/codex.png'
import geminiMark from '../media/providers/gemini.png'
import grokMark from '../media/providers/grok.png'
import kimiMark from '../media/providers/kimi.png'
import ollamaMark from '../media/providers/ollama.png'
import GeneratedField from './art/GeneratedField'
import InsetRing from './InsetRing'

const MARKS: Record<string, string> = {
  claude: claudeMark,
  codex: codexMark,
  kimi: kimiMark,
  grok: grokMark,
  gemini: geminiMark,
  local: ollamaMark
}

// The mark is worn at a handful of sizes off the class it is handed, and the
// picture underneath is sampled against a box rather than a class. This is the
// one it is really drawn at everywhere it stands beside a row of type.
const MARK_BOX = 16

// A vendor wears its own app icon. A server somebody stood up themselves has no
// logo to wear, so it takes the scene a plugin and a helper's mark are
// photographed in, worked out from the address, which is the one thing about it
// that is the same on every machine that has it.
export default function ProviderMark({ provider, className = 'w-4 h-4' }: { provider: string; className?: string }) {
  const src = MARKS[provider]
  return (
    <span className={`relative shrink-0 overflow-hidden rounded-[22%] ${className}`}>
      {src ? (
        <img src={src} alt="" draggable={false} className="w-full h-full object-cover" />
      ) : (
        <GeneratedField seed={provider} box={MARK_BOX} />
      )}
      <InsetRing className="ring-1 ring-inset ring-fg/5" />
    </span>
  )
}
