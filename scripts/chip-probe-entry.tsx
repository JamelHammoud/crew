import { createElement as h, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import CommandChip from '../src/renderer/src/components/CommandChip'
import Composer from '../src/renderer/src/components/Composer'
import ThreadCardShell from '../src/renderer/src/components/ThreadCardShell'
import ThreadStatusBar from '../src/renderer/src/components/ThreadStatusBar'
import { ChecklistGlyph, GhostGlyph, ToolboxGlyph } from '../src/renderer/src/icons'
import type { CommandName } from '../src/shared/commands'

const ref = { current: null } as unknown as React.RefObject<HTMLTextAreaElement>

function Row({ commands, value }: { commands: CommandName[]; value: string }) {
  return h(
    'div',
    { className: 'max-w-[660px] w-full mx-auto' },
    h(Composer, {
      attachmentKey: 'chat',
      value,
      placeholder: 'Send a message, @ someone, or / for a command',
      inputRef: ref,
      onChange: () => {},
      onKeyDown: () => {},
      onSend: () => {},
      huddle: true,
      chips: commands.map(name => h(CommandChip, { key: name, name, onRemove: () => {} }))
    })
  )
}

const sizes = ['w-12 h-12', 'w-8 h-8', 'w-6 h-6', 'w-5 h-5', 'w-4 h-4']

const marks = h(
  'div',
  { className: 'max-w-[660px] w-full mx-auto flex items-end gap-6 text-fg' },
  ...sizes.map(size =>
    h(
      'div',
      { key: size, className: 'flex items-end gap-3' },
      h(GhostGlyph, { className: size }),
      h(ChecklistGlyph, { className: size }),
      h(ToolboxGlyph, { className: size })
    )
  )
)

const thread = (mode: 'plan' | 'build', ghost?: boolean, title = 'tidy up the readme and the changelog') =>
  h(
    'div',
    { key: `${mode}${ghost}${title}`, className: 'max-w-[660px] w-full mx-auto' },
    h(ThreadCardShell, {
      thread: {
        id: 't',
        agentId: 'a',
        agentLabel: 'Fable',
        title,
        createdBy: 'Jamel',
        status: 'open' as const,
        mode,
        ghost
      },
      ts: 0,
      onOpen: () => {},
      children: h(ThreadStatusBar, {
        thread: { id: 't', agentId: 'a', agentLabel: 'Fable', title, createdBy: 'Jamel', status: 'open', mode, ghost },
        icon: h(ChecklistGlyph, { className: 'w-4 h-4 text-fg shrink-0' }),
        label: 'Planning complete'
      })
    })
  )

const rows: ReactNode[] = [
  marks,
  thread('plan'),
  thread('build', true, 'read the readme'),
  thread('plan', true),
  h(Row, { key: 'none', commands: [], value: '' }),
  h(Row, { key: 'plan', commands: ['plan'], value: '' }),
  h(Row, { key: 'both', commands: ['plan', 'ghost'], value: '' }),
  h(Row, { key: 'typed', commands: ['ghost'], value: 'Have a look at the readme and tell me what is wrong with it' })
]

process.stdout.write(
  renderToStaticMarkup(h('div', { className: 'flex flex-col gap-8 p-8 bg-ink-900' }, ...rows))
)
