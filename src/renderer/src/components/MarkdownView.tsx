import Markdown from './Markdown'
import { useLocalImages } from './mdImages'

export default function MarkdownView({
  path,
  text,
  partial = false
}: {
  path: string
  text: string
  partial?: boolean
}) {
  const images = useLocalImages(path, text)
  return (
    <div data-markdown-page className="min-h-full px-5 py-4">
      <Markdown text={text} images={images} breaks={false} />
      {partial && <p className="select-none mt-4 text-xs text-fg-muted">Showing the beginning of this file</p>}
    </div>
  )
}
