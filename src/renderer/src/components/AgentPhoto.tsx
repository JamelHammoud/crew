import { ArrowUpTrayIcon, PhotoIcon, TrashIcon } from '@heroicons/react/16/solid'
import { useRef, useState } from 'react'
import { IMAGE_TYPES } from '../../../shared/attachments'
import type { PooledAgent } from '../../../shared/llm'
import AgentIcon from './AgentIcon'
import { MenuItem, Popover } from './Popover'

const ACCEPT = Object.keys(IMAGE_TYPES).join(',')

export default function AgentPhoto({
  agent,
  presence,
  onChange
}: {
  agent: PooledAgent
  presence: 'online' | 'offline'
  onChange: (file: File | null) => void
}) {
  const [menu, setMenu] = useState(false)
  const picker = useRef<HTMLInputElement>(null)

  const pick = () => {
    setMenu(false)
    picker.current?.click()
  }

  return (
    <span className="relative inline-flex shrink-0 self-start">
      <AgentIcon seed={agent.id} presence={presence} />
      <button
        onClick={() => (agent.avatar ? setMenu(true) : pick())}
        aria-label={agent.avatar ? 'Change photo' : 'Add a photo'}
        className="absolute inset-0 rounded-full flex items-center justify-center bg-ink-900/70 text-fg opacity-0 transition-all duration-150 hover:opacity-100 focus-visible:opacity-100 active:scale-95"
      >
        <PhotoIcon className="w-4 h-4" />
      </button>
      <Popover open={menu} onClose={() => setMenu(false)} align="start">
        <MenuItem icon={<ArrowUpTrayIcon />} label="Change photo" onClick={pick} />
        <MenuItem
          icon={<TrashIcon />}
          label="Remove photo"
          danger
          onClick={() => {
            setMenu(false)
            onChange(null)
          }}
        />
      </Popover>
      <input
        ref={picker}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={event => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) onChange(file)
        }}
      />
    </span>
  )
}
