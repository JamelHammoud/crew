import { Row, SheetHeader } from './toolboxParts'
import { TOOL_KINDS, type ToolKind } from './toolKinds'

// What a tool does is a screen of its own rather than a grid in the form. There
// are more kinds than a grid can hold without pushing the fields off the
// bottom, and a row has the width to say what each one is for.
export default function ToolKindPicker({
  kind,
  onPick,
  onBack
}: {
  kind: ToolKind
  onPick: (kind: ToolKind) => void
  onBack: () => void
}) {
  return (
    <>
      <SheetHeader title="What it does" onBack={onBack} />
      <div className="p-1.5">
        {TOOL_KINDS.map(entry => (
          <Row
            key={entry.kind}
            mark={<entry.mark className="w-[18px] h-[18px]" />}
            title={entry.title}
            note={entry.note}
            active={kind === entry.kind}
            onClick={() => onPick(entry.kind)}
          />
        ))}
      </div>
    </>
  )
}
