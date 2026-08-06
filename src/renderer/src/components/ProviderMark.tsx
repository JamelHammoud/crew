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

export default function ProviderMark({ provider, className = 'w-4 h-4' }: { provider: string; className?: string }) {
  const src = MARKS[provider]
  if (!src) return null
  return (
    <span className={`relative shrink-0 overflow-hidden rounded-[22%] ${className}`}>
      <img src={src} alt="" draggable={false} className="w-full h-full object-cover" />
      <InsetRing className="ring-1 ring-inset ring-fg/5" />
    </span>
  )
}
