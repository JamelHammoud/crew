import HtmlView from '../HtmlView'
import { readText } from './bytes'
import { Failed, Loading } from './Frame'
import { useRead } from './useRead'

// The page a file is written to be, stood up away from the address the session is
// served on. The words are read here and written out where the app can load
// them, which is the same way a page in the project is drawn, so nothing on a
// page anybody sent is ever running inside the session.
export default function PagePreview({ id, url }: { id: string; url: string }) {
  const { data, failed } = useRead(url, readText)
  if (failed) return <Failed label="Could not read this file" />
  if (!data) return <Loading />
  return <HtmlView id={id} path="" text={data.text} partial={data.partial} />
}
