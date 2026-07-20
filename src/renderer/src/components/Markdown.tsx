import DOMPurify from 'dompurify'
import { marked } from 'marked'

export default function Markdown({ text }: { text: string }) {
  const html = DOMPurify.sanitize(marked.parse(text, { async: false }) as string)
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />
}
