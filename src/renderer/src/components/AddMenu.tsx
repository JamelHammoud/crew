import { useState, type RefObject } from 'react'
import { attachmentBytes, MAX_ATTACHMENTS } from '../../../shared/attachments'
import { GifGlyph, PlusGlyph, SignalGlyph, SparkGlyph, UploadGlyph } from '../icons'
import { useHuddle } from '../state/huddle'
import { useCrew } from '../state/store'
import { ATTACH_SIZES, PLUS_BUTTON, useFilePicker } from './Attachments'
import DefaultAgentPicker from './DefaultAgentPicker'
import GifPicker from './GifPicker'
import { gifFile, type Gif } from './gifs'
import { MenuDivider, MenuItem, Popover } from './Popover'
import ScreenSwap from './ScreenSwap'
import Tooltip from './Tooltip'

type Screen = 'menu' | 'gif' | 'agent'

const DEPTH: Record<Screen, number> = { menu: 0, gif: 1, agent: 1 }

export default function AddMenu({
  attachmentKey,
  huddle,
  defaultAgent,
  inputRef,
  onSend
}: {
  attachmentKey: string
  huddle?: boolean
  // Only the chat can stand an agent on its own composer. A thread already has
  // one, and a message in it goes there whatever anybody picked.
  defaultAgent?: boolean
  inputRef: RefObject<HTMLTextAreaElement>
  onSend: () => void
}) {
  const count = useCrew(s => (s.pending[attachmentKey] ?? []).length)
  const attach = useCrew(s => s.attach)
  const cap = attachmentBytes(useCrew(s => s.attachmentMb))
  const joined = useHuddle(s => s.joined)
  const live = useHuddle(s => s.room.peers.length > 0)
  const join = useHuddle(s => s.join)
  const { input, choose } = useFilePicker(attachmentKey)
  const [open, setOpen] = useState(false)
  const [screen, setScreen] = useState<Screen>('menu')
  const full = count >= MAX_ATTACHMENTS
  const calling = huddle === true && !joined
  // With nobody here there is nobody to pick, so the row is left out rather
  // than opening on an empty card.
  const anyone = useCrew(s => s.agents.some(agent => agent.status !== 'offline'))
  const aiming = defaultAgent === true && anyone

  const show = () => {
    setScreen('menu')
    setOpen(true)
  }

  const pick = async (gif: Gif) => {
    await attach(attachmentKey, [await gifFile(gif, cap)])
    setOpen(false)
    onSend()
  }

  return (
    <>
      {input}
      <Tooltip label={full ? `Up to ${MAX_ATTACHMENTS} files` : 'Add to your message'} disabled={open}>
        <button
          onClick={() => (open ? setOpen(false) : show())}
          disabled={full && !calling}
          aria-label="Add to your message"
          aria-expanded={open}
          data-active={open ? '' : undefined}
          className={`${ATTACH_SIZES.md} ${PLUS_BUTTON}`}
        >
          <PlusGlyph className="w-5 h-5" />
        </button>
      </Tooltip>
      <Popover open={open} onClose={() => setOpen(false)} align="start" side="top" flush>
        <ScreenSwap screen={screen} depth={DEPTH[screen]} width>
          {screen === 'menu' ? (
            <div className="p-1.5">
              {!full && (
                <>
                  <MenuItem
                    icon={<UploadGlyph />}
                    label="Upload a file"
                    onClick={() => {
                      setOpen(false)
                      choose()
                    }}
                  />
                  <MenuItem icon={<GifGlyph />} label="Pick a GIF" onClick={() => setScreen('gif')} />
                </>
              )}
              {aiming && (
                <>
                  {!full && <MenuDivider />}
                  <MenuItem icon={<SparkGlyph />} label="Agent" into onClick={() => setScreen('agent')} />
                </>
              )}
              {calling && (
                <>
                  {(!full || aiming) && <MenuDivider />}
                  <MenuItem
                    icon={<SignalGlyph />}
                    label={live ? 'Join the huddle' : 'Huddle'}
                    onClick={() => {
                      setOpen(false)
                      void join()
                    }}
                  />
                </>
              )}
            </div>
          ) : screen === 'agent' ? (
            <DefaultAgentPicker
              onPick={() => {
                setOpen(false)
                inputRef.current?.focus()
              }}
            />
          ) : (
            <GifPicker onPick={pick} />
          )}
        </ScreenSwap>
      </Popover>
    </>
  )
}
