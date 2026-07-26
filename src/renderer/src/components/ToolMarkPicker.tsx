import { useState } from 'react'
import { TOOL_MARKS } from '../../../shared/toolbox'
import EmojiPicker from './EmojiPicker'
import { rememberEmoji } from './emojiRecents'
import ToolMarkView, { glyphFor } from './toolMark'
import { Segmented, SheetHeader } from './toolboxParts'

export default function ToolMarkPicker({
  mark,
  onPick,
  onBack
}: {
  mark: string
  onPick: (mark: string) => void
  onBack: () => void
}) {
  const [set, setSet] = useState<'icons' | 'emoji'>(glyphFor(mark) ? 'icons' : 'emoji')

  return (
    <>
      <SheetHeader title="Choose a mark" onBack={onBack} />
      <div className="p-2.5 pb-0">
        <Segmented
          value={set}
          onChange={setSet}
          options={[
            { value: 'icons', label: 'Icons' },
            { value: 'emoji', label: 'Emoji' }
          ]}
        />
      </div>
      {set === 'icons' ? (
        <div className="p-2.5 grid grid-cols-6 gap-1">
          {TOOL_MARKS.map(choice => (
            <button
              key={choice}
              onClick={() => onPick(choice)}
              aria-label={choice}
              aria-pressed={mark === choice}
              className={`h-11 rounded-field flex items-center justify-center transition-all duration-150 active:scale-90 ${
                mark === choice ? 'bg-fg text-ink-900' : 'text-fg/45 hover:text-fg hover:bg-fg/[0.06]'
              }`}
            >
              <ToolMarkView mark={choice} className="w-5 h-5" />
            </button>
          ))}
        </div>
      ) : (
        <EmojiPicker
          columns={7}
          className="h-[352px] w-full"
          purpose="Use"
          hint="Pick a mark"
          selected={new Set([mark])}
          onPick={char => {
            rememberEmoji(char)
            onPick(char)
          }}
        />
      )}
    </>
  )
}
