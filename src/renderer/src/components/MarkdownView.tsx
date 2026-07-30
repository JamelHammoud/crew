import Markdown from './Markdown'
import { useLocalImages } from './mdImages'

export default function MarkdownView({ path, text }: { path: string; text: string }) {
  const images = useLocalImages(path, text)
  return (
    <div data-markdown-page className="min-h-full px-5 py-4">
      <Markdown text={text} images={images} />
    </div>
  )
}
