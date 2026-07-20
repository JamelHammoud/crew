import {
  BoldIcon,
  CodeBracketIcon,
  CodeBracketSquareIcon,
  H1Icon,
  H2Icon,
  H3Icon,
  ItalicIcon,
  ListBulletIcon,
  NumberedListIcon,
  StrikethroughIcon
} from '@heroicons/react/16/solid'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useReducer, type ComponentType, type SVGProps } from 'react'
import { Markdown } from 'tiptap-markdown'
import Tooltip from './Tooltip'

function ToolButton({
  icon: Icon,
  label,
  active,
  onClick
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <Tooltip label={label}>
      <button
        onMouseDown={event => event.preventDefault()}
        onClick={onClick}
        aria-label={label}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
          active ? 'bg-ink-600 text-fg' : 'text-fg-muted hover:text-fg hover:bg-white/[0.06]'
        }`}
      >
        <Icon className="w-4 h-4" />
      </button>
    </Tooltip>
  )
}

function Divider() {
  return <span className="w-px h-5 bg-white/[0.08] mx-1" />
}

function Toolbar({ editor }: { editor: Editor }) {
  const [, force] = useReducer(x => x + 1, 0)

  useEffect(() => {
    editor.on('transaction', force)
    return () => {
      editor.off('transaction', force)
    }
  }, [editor])

  const heading = (level: 1 | 2 | 3) => editor.chain().focus().toggleHeading({ level }).run()

  return (
    <div className="flex items-center gap-0.5 bg-ink-800 rounded-full px-2 h-11">
      <ToolButton icon={H1Icon} label="Heading 1" active={editor.isActive('heading', { level: 1 })} onClick={() => heading(1)} />
      <ToolButton icon={H2Icon} label="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => heading(2)} />
      <ToolButton icon={H3Icon} label="Heading 3" active={editor.isActive('heading', { level: 3 })} onClick={() => heading(3)} />
      <Divider />
      <ToolButton icon={BoldIcon} label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} />
      <ToolButton icon={ItalicIcon} label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} />
      <ToolButton
        icon={StrikethroughIcon}
        label="Strikethrough"
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <Divider />
      <ToolButton
        icon={ListBulletIcon}
        label="Bullet list"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolButton
        icon={NumberedListIcon}
        label="Numbered list"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <Divider />
      <ToolButton
        icon={CodeBracketIcon}
        label="Inline code"
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
      />
      <ToolButton
        icon={CodeBracketSquareIcon}
        label="Code block"
        active={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      />
    </div>
  )
}

export default function DocEditor({
  page,
  text,
  onChange
}: {
  page: string
  text: string
  onChange: (markdown: string) => void
}) {
  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Placeholder.configure({ placeholder: 'Plan together. Type to start writing.' }),
        Markdown.configure({ transformPastedText: true, transformCopiedText: true })
      ],
      content: text,
      onUpdate: ({ editor: current }) => onChange(current.storage.markdown.getMarkdown())
    },
    [page]
  )

  useEffect(() => {
    if (!editor || editor.isFocused) return
    const current = editor.storage.markdown.getMarkdown()
    if (current !== text) editor.commands.setContent(text)
  }, [text, editor])

  if (!editor) return null

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex justify-center shrink-0">
        <Toolbar editor={editor} />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto cursor-text" onClick={() => editor.chain().focus().run()}>
        <EditorContent editor={editor} className="doc max-w-[720px] mx-auto pt-8 pb-40" />
      </div>
    </div>
  )
}
