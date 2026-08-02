import claudeMark from '../media/providers/claude.png'
import codexMark from '../media/providers/codex.png'
import grokMark from '../media/providers/grok.png'
import kimiMark from '../media/providers/kimi.png'
import ollamaMark from '../media/providers/ollama.png'

const MARKS: Record<string, { src: string; zoom?: number }> = {
  claude: { src: claudeMark },
  codex: { src: codexMark },
  kimi: { src: kimiMark },
  grok: { src: grokMark, zoom: 1.28 },
  local: { src: ollamaMark }
}

export default function ProviderMark({ provider, className = 'w-4 h-4' }: { provider: string; className?: string }) {
  const mark = MARKS[provider]
  if (!mark) return null
  return (
    <span className={`shrink-0 overflow-hidden rounded-[22%] ${className}`}>
      <img
        src={mark.src}
        alt=""
        draggable={false}
        style={mark.zoom ? { transform: `scale(${mark.zoom})` } : undefined}
        className="w-full h-full object-cover"
      />
    </span>
  )
}
