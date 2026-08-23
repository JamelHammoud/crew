import { useCallback, useRef, useState } from 'react'
import { DEFAULT_MARK, NAME_LIMIT, type CrewTool, type ToolAction } from '../../../shared/toolbox'
import { PencilGlyph } from '../icons'
import { useCrew } from '../state/store'
import { closeBuilder, useToolBuilder } from '../state/toolBuilder'
import { Rule } from './cardParts'
import Modal from './Modal'
import { Popover } from './Popover'
import TextField from './TextField'
import ToolDoes from './ToolDoes'
import { TOOL_KINDS, type ToolKind } from './toolKinds'
import ToolMarkPicker from './ToolMarkPicker'
import ToolMarkView from './toolMark'
import Tooltip from './Tooltip'

const KINDS = TOOL_KINDS.map(one => one.kind)

// A tool is written on the card a schedule is written on: what to call it, what
// it does, and the one field that kind asks for. The mark stays a control here
// where a schedule's is worked out for it, since a mark is the face the tile
// wears and the only place it is chosen.
function Builder({ tool, onClose }: { tool: CrewTool | null; onClose: () => void }) {
  const addTool = useCrew(s => s.addTool)
  const editTool = useCrew(s => s.editTool)
  const removeTool = useCrew(s => s.removeTool)
  const [name, setName] = useState(tool?.name ?? '')
  const [mark, setMark] = useState<string>(tool?.mark ?? DEFAULT_MARK)
  const [kind, setKind] = useState<ToolKind>(tool?.action.kind ?? 'web')
  const [action, setAction] = useState<ToolAction | null>(tool?.action ?? null)
  const [marking, setMarking] = useState(false)
  const markRef = useRef<HTMLSpanElement>(null)

  const took = useCallback((next: ToolAction | null) => setAction(next), [])

  const ready = name.trim() !== '' && action !== null

  const save = () => {
    if (!action || !name.trim()) return
    if (tool) editTool(tool.id, name, mark, action)
    else addTool(name, mark, action)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={tool ? 'Edit tool' : 'New tool'}
      width={520}
      footer={
        <div className="flex items-center gap-2">
          {tool && (
            <button
              onClick={() => {
                removeTool(tool.id)
                onClose()
              }}
              className="h-10 px-4 rounded-full text-sm font-semibold text-fg/45 transition-colors hover:text-danger"
            >
              Remove
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="h-10 px-4 rounded-full text-sm font-semibold text-fg/45 transition-colors hover:text-fg"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!ready}
            className="h-10 px-5 rounded-full bg-fg text-ink-900 text-sm font-semibold transition-all duration-150 hover:bg-fg/90 active:scale-95 disabled:bg-fg/10 disabled:text-fg/45"
          >
            {tool ? 'Save' : 'Add to toolbox'}
          </button>
        </div>
      }
    >
      <div className="mt-4 space-y-4">
        <div className="flex items-center gap-3">
          <span ref={markRef} className="group relative flex shrink-0">
            <Tooltip label="Choose a mark" disabled={marking}>
              <button
                onClick={() => setMarking(open => !open)}
                aria-label="Choose a mark"
                className="w-9 h-9 rounded-full flex items-center justify-center bg-fg/[0.07] text-fg/70 transition-all duration-150 hover:bg-fg/[0.12] hover:text-fg active:scale-95"
              >
                <ToolMarkView mark={mark} className="w-[18px] h-[18px]" />
              </button>
            </Tooltip>
            <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center bg-fg text-ink-900 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              <PencilGlyph className="w-2 h-2" />
            </span>
          </span>
          <TextField
            glass
            autoFocus
            value={name}
            maxLength={NAME_LIMIT}
            placeholder="What to call it"
            aria-label="Name"
            onChange={event => setName(event.target.value)}
            onKeyDown={event => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              save()
            }}
          />
          <Popover
            open={marking}
            onClose={() => setMarking(false)}
            anchor={markRef}
            align="start"
            flush
            className="w-[262px]"
          >
            <ToolMarkPicker
              mark={mark}
              onPick={chosen => {
                setMark(chosen)
                setMarking(false)
              }}
            />
          </Popover>
        </div>

        <Rule />
        <ToolDoes
          kinds={KINDS}
          kind={kind}
          onKind={setKind}
          initial={tool?.action ?? null}
          exclude={tool?.id}
          blanks
          onChange={took}
        />
      </div>

    </Modal>
  )
}

// Mounted once, the way the settings card is, so the card stands wherever it was
// raised from and is built fresh each time rather than holding the last tool it
// was opened on.
export default function ToolBuilder() {
  const building = useToolBuilder()
  if (!building) return null
  return <Builder key={building.tool?.id ?? 'new'} tool={building.tool} onClose={closeBuilder} />
}
