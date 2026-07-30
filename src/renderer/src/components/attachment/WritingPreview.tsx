import DOMPurify from 'dompurify'
import mammoth from 'mammoth'
import { Failed, Loading } from './Frame'
import { useRead } from './useRead'

export const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const convert = async (bytes: ArrayBuffer): Promise<string> => {
  const done = await mammoth.convertToHtml({ arrayBuffer: bytes })
  return DOMPurify.sanitize(done.value)
}

export default function WritingPreview({ url }: { url: string }) {
  const { data, failed } = useRead(url, convert)
  if (failed) return <Failed label="Could not read this file" />
  if (data === null) return <Loading />
  return (
    <div className="absolute inset-0 overflow-auto">
      <div className="md select-text min-h-full px-5 py-4" dangerouslySetInnerHTML={{ __html: data }} />
    </div>
  )
}
