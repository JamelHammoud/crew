import {
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  Bars3BottomLeftIcon,
  Bars3BottomRightIcon,
  Bars3Icon,
  CheckIcon,
  ChevronDownIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon
} from '@heroicons/react/16/solid'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from 'react'
import {
  DefaultColorStyle,
  DefaultDashStyle,
  DefaultFillStyle,
  DefaultFontStyle,
  DefaultMainMenu,
  DefaultSizeStyle,
  DefaultTextAlignStyle,
  getColorValue,
  useCanRedo,
  useCanUndo,
  useEditor,
  useRelevantStyles,
  useValue,
  type SharedStyle,
  type StyleProp
} from 'tldraw'
import { useCrew } from '../state/store'
import { Popover } from './Popover'
import Tooltip from './Tooltip'

export const DesignBoardContext = createContext<{ current: string; select: (id: string) => void }>({
  current: '',
  select: () => {}
})

export function DesignMenu() {
  return (
    <div className="m-3 pointer-events-auto">
      <div className="design-menu glass rounded-full h-12 flex items-center gap-0.5 px-1">
        <DefaultMainMenu />
        <span className="w-px h-4 bg-fg/10 shrink-0" />
        <BoardSwitcher />
      </div>
    </div>
  )
}

function BoardSwitcher() {
  const { current, select } = useContext(DesignBoardContext)
  const boards = useCrew(s => s.boards)
  const createBoard = useCrew(s => s.createBoard)
  const renameBoard = useCrew(s => s.renameBoard)
  const deleteBoard = useCrew(s => s.deleteBoard)
  const [open, setOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const board = boards.find(b => b.id === current)

  useEffect(() => {
    if (renaming) {
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }, [renaming])

  if (!board) return null

  const startRename = (id: string, name: string) => {
    select(id)
    setDraft(name)
    setRenaming(true)
    setOpen(false)
  }

  const commitRename = () => {
    const clean = draft.trim()
    if (clean && clean !== board.name) renameBoard(board.id, clean)
    setRenaming(false)
  }

  const startCreate = () => {
    const id = createBoard('Untitled')
    startRename(id, 'Untitled')
  }

  if (renaming) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commitRename}
        onKeyDown={e => {
          if (e.key === 'Enter') commitRename()
          if (e.key === 'Escape') setRenaming(false)
        }}
        className="h-10 w-44 bg-transparent px-3.5 text-sm font-semibold text-fg outline-none"
      />
    )
  }

  return (
    <span>
      <button
        onClick={() => setOpen(value => !value)}
        onDoubleClick={() => startRename(board.id, board.name)}
        className="h-10 rounded-full pl-3.5 pr-3 flex items-center gap-1.5 text-sm font-semibold text-fg transition-colors hover:bg-fg/[0.06]"
      >
        <span className="truncate max-w-40">{board.name}</span>
        <ChevronDownIcon
          className={`w-3.5 h-3.5 text-fg-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} align="start">
        <div className="w-56">
          {boards.map(b => (
            <div key={b.id} className="group flex items-center gap-0.5 pr-1 rounded-xl transition-colors hover:bg-fg/5">
              <button
                onClick={() => {
                  select(b.id)
                  setOpen(false)
                }}
                className={`flex-1 min-w-0 flex items-center gap-2 pl-3 pr-1 py-2 text-sm text-left ${
                  b.id === current ? 'text-fg font-semibold' : 'text-fg-secondary'
                }`}
              >
                <span className="truncate flex-1">{b.name}</span>
                {b.id === current && <CheckIcon className="w-3.5 h-3.5 shrink-0" />}
              </button>
              <button
                onClick={() => startRename(b.id, b.name)}
                aria-label="Rename board"
                className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-fg-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-fg hover:bg-fg/[0.08]"
              >
                <PencilIcon className="w-3 h-3" />
              </button>
              <button
                onClick={() => deleteBoard(b.id)}
                aria-label="Delete board"
                className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-fg-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger hover:bg-danger/10"
              >
                <TrashIcon className="w-3 h-3" />
              </button>
            </div>
          ))}
          <div className="h-px bg-fg/10 my-1 mx-2" />
          <button
            onClick={startCreate}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-fg-secondary transition-colors hover:text-fg hover:bg-fg/5"
          >
            <PlusIcon className="w-4 h-4 shrink-0" />
            New board
          </button>
        </div>
      </Popover>
    </span>
  )
}

function RoundButton({
  label,
  disabled,
  onClick,
  children
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip label={label}>
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className="w-10 h-10 rounded-full flex items-center justify-center text-fg-muted transition-all enabled:hover:text-fg enabled:hover:bg-fg/[0.06] enabled:active:scale-95 disabled:opacity-30"
      >
        {children}
      </button>
    </Tooltip>
  )
}

export function DesignNavigation() {
  const editor = useEditor()
  const canUndo = useCanUndo()
  const canRedo = useCanRedo()
  const zoom = useValue('design zoom', () => editor.getZoomLevel(), [editor])
  return (
    <div className="m-3 pointer-events-auto">
      <div className="glass rounded-full h-12 flex items-center px-1">
        <RoundButton label="Zoom out" onClick={() => editor.zoomOut()}>
          <MinusIcon className="w-4 h-4" />
        </RoundButton>
        <Tooltip label="Zoom to 100%">
          <button
            onClick={() => editor.resetZoom()}
            className="h-10 min-w-11 px-1 rounded-full text-xs font-semibold tabular-nums text-fg-secondary transition-colors hover:text-fg hover:bg-fg/[0.06]"
          >
            {Math.round(zoom * 100)}%
          </button>
        </Tooltip>
        <RoundButton label="Zoom in" onClick={() => editor.zoomIn()}>
          <PlusIcon className="w-4 h-4" />
        </RoundButton>
        <span className="w-px h-4 bg-fg/10 mx-1 shrink-0" />
        <RoundButton label="Undo" disabled={!canUndo} onClick={() => editor.undo()}>
          <ArrowUturnLeftIcon className="w-4 h-4" />
        </RoundButton>
        <RoundButton label="Redo" disabled={!canRedo} onClick={() => editor.redo()}>
          <ArrowUturnRightIcon className="w-4 h-4" />
        </RoundButton>
      </div>
    </div>
  )
}

function useApplyStyle() {
  const editor = useEditor()
  return useCallback(
    <T,>(style: StyleProp<T>, value: T) => {
      editor.run(() => {
        editor.markHistoryStoppingPoint()
        if (editor.isIn('select')) editor.setStyleForSelectedShapes(style, value)
        editor.setStyleForNextShapes(style, value)
      })
    },
    [editor]
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-fg-muted">{label}</span>
      {children}
    </div>
  )
}

function Segments<T extends string>({
  value,
  options,
  onPick
}: {
  value: string | null
  options: ReadonlyArray<{ value: T; label?: string; icon?: ReactNode; style?: CSSProperties; className?: string }>
  onPick: (value: T) => void
}) {
  return (
    <div className="flex bg-fg/[0.06] rounded-full p-0.5">
      {options.map(option => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            onClick={() => onPick(option.value)}
            style={option.style}
            className={`flex-1 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
              active ? 'bg-fg text-ink-900' : 'text-fg-muted hover:text-fg'
            } ${option.className ?? ''}`}
          >
            {option.icon ?? option.label}
          </button>
        )
      })}
    </div>
  )
}

const FILL_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'semi', label: 'Semi' },
  { value: 'solid', label: 'Soft' },
  { value: 'fill', label: 'Fill' }
] as const

const DASH_OPTIONS = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dash' },
  { value: 'dotted', label: 'Dot' }
] as const

const SIZE_OPTIONS = [
  { value: 's', dot: 'w-1 h-1' },
  { value: 'm', dot: 'w-1.5 h-1.5' },
  { value: 'l', dot: 'w-2 h-2' },
  { value: 'xl', dot: 'w-2.5 h-2.5' }
] as const

const FONT_OPTIONS = [
  { value: 'sans', label: 'Sans' },
  { value: 'serif', label: 'Serif', style: { fontFamily: 'Georgia, serif' } },
  { value: 'mono', label: 'Mono', className: 'font-mono' }
] as const

export function DesignStylePanel() {
  const editor = useEditor()
  const styles = useRelevantStyles()
  const apply = useApplyStyle()
  const opacity = useValue('design opacity', () => editor.getSharedOpacity(), [editor])
  const swatches = useValue(
    'design swatches',
    () => {
      const palette = editor.getCurrentTheme().colors[editor.getColorMode()]
      return DefaultColorStyle.values.map(name => ({ name, hex: getColorValue(palette, name, 'solid') }))
    },
    [editor]
  )
  if (!styles) return null

  const color = styles.get(DefaultColorStyle)
  const fill = styles.get(DefaultFillStyle)
  const dash = styles.get(DefaultDashStyle)
  const size = styles.get(DefaultSizeStyle)
  const font = styles.get(DefaultFontStyle)
  const align = styles.get(DefaultTextAlignStyle)
  const opacityValue = opacity.type === 'shared' ? opacity.value : 1
  const shared = <T extends string>(style?: SharedStyle<T>) =>
    style && style.type === 'shared' ? style.value : null

  const setOpacity = (value: number) => {
    editor.run(() => {
      editor.setOpacityForSelectedShapes(value)
      editor.setOpacityForNextShapes(value)
    })
  }

  return (
    <div className="design-style-panel glass rounded-2xl w-56 m-3 p-3 pointer-events-auto animate-pop flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
      {color && (
        <Section label="Color">
          <div className="flex flex-wrap gap-1.5">
            {swatches.map(swatch => {
              const active = shared(color) === swatch.name
              return (
                <button
                  key={swatch.name}
                  onClick={() => apply(DefaultColorStyle, swatch.name)}
                  aria-label={swatch.name}
                  style={{ background: swatch.hex }}
                  className={`w-5 h-5 rounded-full transition-transform hover:scale-110 active:scale-95 ${
                    active ? 'ring-2 ring-fg ring-offset-2 ring-offset-ink-800' : 'ring-1 ring-inset ring-fg/10'
                  }`}
                />
              )
            })}
          </div>
        </Section>
      )}
      {fill && (
        <Section label="Fill">
          <Segments value={shared(fill)} options={FILL_OPTIONS} onPick={value => apply(DefaultFillStyle, value)} />
        </Section>
      )}
      {(dash || size) && (
        <Section label="Stroke">
          {dash && (
            <Segments value={shared(dash)} options={DASH_OPTIONS} onPick={value => apply(DefaultDashStyle, value)} />
          )}
          {size && (
            <Segments
              value={shared(size)}
              options={SIZE_OPTIONS.map(option => ({
                value: option.value,
                icon: <span className={`${option.dot} rounded-full bg-current`} />
              }))}
              onPick={value => apply(DefaultSizeStyle, value)}
            />
          )}
        </Section>
      )}
      {(font || align) && (
        <Section label="Text">
          {font && (
            <Segments value={shared(font)} options={FONT_OPTIONS} onPick={value => apply(DefaultFontStyle, value)} />
          )}
          {align && (
            <Segments
              value={shared(align)}
              options={[
                { value: 'start', icon: <Bars3BottomLeftIcon className="w-4 h-4" /> },
                { value: 'middle', icon: <Bars3Icon className="w-4 h-4" /> },
                { value: 'end', icon: <Bars3BottomRightIcon className="w-4 h-4" /> }
              ]}
              onPick={value => apply(DefaultTextAlignStyle, value)}
            />
          )}
        </Section>
      )}
      <Section label="Opacity">
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.01}
            value={opacityValue}
            onChange={e => setOpacity(Number(e.target.value))}
            className="flex-1 min-w-0"
          />
          <span className="w-8 text-right text-xs tabular-nums text-fg-muted">{Math.round(opacityValue * 100)}%</span>
        </div>
      </Section>
    </div>
  )
}
