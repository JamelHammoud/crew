import { useEffect, useRef, useState } from 'react'
import {
  FEEDBACK_EMAIL,
  FEEDBACK_LIMIT,
  feedbackBody,
  feedbackMailto,
  type SystemDetails
} from '../../../../shared/feedback'
import { toast } from '../../state/toast'
import Modal from '../Modal'
import { Action, Row } from './parts'

const BLANK: SystemDetails = { version: '', platform: '', release: '', arch: '' }

const FIELD =
  'w-full h-40 px-3.5 py-3 rounded-xl bg-fg/[0.07] text-sm leading-5 text-fg placeholder:text-fg/35 outline-none border-none resize-none transition-colors focus:bg-fg/[0.11]'

export default function FeedbackRow() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [stuck, setStuck] = useState(false)
  const [details, setDetails] = useState<SystemDetails>(BLANK)
  const field = useRef<HTMLTextAreaElement>(null)
  const said = text.trim()

  useEffect(() => {
    let live = true
    void window.crew
      ?.systemInfo()
      .then(next => live && setDetails(next))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setText('')
    setStuck(false)
    field.current?.focus()
  }, [open])

  const send = async () => {
    if (!said) return
    // A machine with no mail app set up fails exactly the way one with a mail
    // app succeeds, so the card stays and the words stay with it.
    if (await window.crew.openExternal(feedbackMailto(said, details))) setOpen(false)
    else setStuck(true)
  }

  const copy = async () => {
    if (!said) return
    await navigator.clipboard.writeText(feedbackBody(said, details))
    setOpen(false)
    toast('Feedback copied', { tone: 'done' })
  }

  return (
    <>
      <Row label="Feedback">
        <Action label="Submit feedback" onClick={() => setOpen(true)} />
      </Row>
      <Modal open={open} onClose={() => setOpen(false)} title="Submit feedback">
        <textarea
          ref={field}
          value={text}
          maxLength={FEEDBACK_LIMIT}
          placeholder="What went wrong, or what would be better"
          aria-label="Feedback"
          onChange={event => setText(event.target.value)}
          className={`mt-4 ${FIELD}`}
        />
        {stuck && (
          <p className="mt-2.5 text-sm text-danger">
            No mail app opened. Copy it and send it to{' '}
            <span className="select-text">{FEEDBACK_EMAIL}</span>.
          </p>
        )}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={() => setOpen(false)}
            className="h-10 px-4 rounded-full text-sm font-semibold text-fg/45 transition-colors hover:text-fg"
          >
            Cancel
          </button>
          <button
            onClick={() => void (stuck ? copy() : send())}
            disabled={!said}
            className="h-10 px-5 rounded-full bg-fg text-ink-900 text-sm font-semibold transition-colors duration-150 hover:bg-fg/90 active:scale-95 disabled:bg-fg/10 disabled:text-fg/45"
          >
            {stuck ? 'Copy' : 'Send'}
          </button>
        </div>
      </Modal>
    </>
  )
}
