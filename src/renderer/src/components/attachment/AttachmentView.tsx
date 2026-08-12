import { lazy, Suspense } from 'react'
import { PhotoGlyph, WindowGlyph } from '../../icons'
import { useBrowser, type BrowserTab } from '../../state/browser'
import ImageView from '../ImageView'
import Tooltip from '../Tooltip'
import ArchivePreview from './ArchivePreview'
import AudioPreview from './AudioPreview'
import Frame, { FileMark, headerButton, Loading } from './Frame'
import PagePreview from './PagePreview'
import SheetPreview from './SheetPreview'
import TextPreview from './TextPreview'
import VectorPreview from './VectorPreview'
import VideoPreview from './VideoPreview'
import { bothWays, viewFor, type ViewKind } from './view'
import WritingPreview from './WritingPreview'

const PdfPreview = lazy(() => import('./PdfPreview'))

// The other way of reading the file in front of you. The mark is what the file is
// when it is not text, so it stands still while the two are swapped and lights
// while that is the way the file is being read.
function ReadSwitch({ id, kind, asPage }: { id: string; kind: ViewKind; asPage: boolean }) {
  const vector = kind === 'vector'
  const Mark = vector ? PhotoGlyph : WindowGlyph
  const label = asPage ? 'Show the text' : vector ? 'Show the picture' : 'Show the page'
  return (
    <Tooltip label={label}>
      <button
        onClick={() => useBrowser.getState().togglePreview(id)}
        aria-label={label}
        aria-pressed={asPage}
        className={`${headerButton} ${asPage ? 'text-fg bg-fg/[0.06]' : ''}`}
      >
        <Mark className="w-4 h-4" />
      </button>
    </Tooltip>
  )
}

function Body({
  id,
  url,
  name,
  mime,
  kind,
  asPage
}: {
  id: string
  url: string
  name: string
  mime: string
  kind: ViewKind
  asPage: boolean
}) {
  const words = <TextPreview url={url} name={name} mime={mime} asPage={asPage} />
  if (!asPage && (kind === 'page' || kind === 'vector')) return words
  switch (kind) {
    case 'image':
      return <ImageView src={url} alt={name} />
    case 'video':
      return <VideoPreview url={url} />
    case 'audio':
      return <AudioPreview url={url} />
    case 'pdf':
      return (
        <Suspense fallback={<Loading />}>
          <PdfPreview url={url} name={name} />
        </Suspense>
      )
    case 'sheet':
      return <SheetPreview url={url} mime={mime} />
    case 'writing':
      return <WritingPreview url={url} />
    case 'archive':
      return <ArchivePreview url={url} />
    case 'page':
      return <PagePreview id={id} url={url} />
    case 'vector':
      return <VectorPreview url={url} name={name} />
    case 'file':
      return <FileMark mime={mime} />
    default:
      return words
  }
}

export default function AttachmentView({ tab }: { tab: BrowserTab }) {
  const kind = viewFor(tab.mime, tab.title)
  return (
    <Frame
      name={tab.title}
      mime={tab.mime}
      size={tab.size}
      url={tab.initialUrl}
      tools={bothWays(tab.mime, tab.title) ? <ReadSwitch id={tab.id} kind={kind} asPage={tab.preview} /> : null}
    >
      <Body id={tab.id} url={tab.initialUrl} name={tab.title} mime={tab.mime} kind={kind} asPage={tab.preview} />
    </Frame>
  )
}
