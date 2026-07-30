import { lazy, Suspense } from 'react'
import type { BrowserTab } from '../../state/browser'
import ImageView from '../ImageView'
import ArchivePreview from './ArchivePreview'
import AudioPreview from './AudioPreview'
import Frame, { FileMark, Loading } from './Frame'
import SheetPreview from './SheetPreview'
import TextPreview from './TextPreview'
import VideoPreview from './VideoPreview'
import { viewFor } from './view'
import WritingPreview from './WritingPreview'

function Body({ url, name, mime }: { url: string; name: string; mime: string }) {
  switch (viewFor(mime)) {
    case 'image':
      return <ImageView src={url} alt={name} />
    case 'video':
      return <VideoPreview url={url} />
    case 'audio':
      return <AudioPreview url={url} />
    case 'pdf':
      return <PdfPreview url={url} name={name} />
    case 'sheet':
      return <SheetPreview url={url} mime={mime} />
    case 'writing':
      return <WritingPreview url={url} />
    case 'archive':
      return <ArchivePreview url={url} />
    case 'file':
      return <FileMark mime={mime} />
    default:
      return <TextPreview url={url} name={name} mime={mime} />
  }
}

export default function AttachmentView({ tab }: { tab: BrowserTab }) {
  return (
    <Frame name={tab.title} mime={tab.mime} size={tab.size} url={tab.initialUrl}>
      <Body url={tab.initialUrl} name={tab.title} mime={tab.mime} />
    </Frame>
  )
}
