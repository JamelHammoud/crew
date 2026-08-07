import HtmlView from '../HtmlView'
import { readText } from './bytes'
import { Failed, Loading } from './Frame'
import { useRead } from './useRead'

// The page a file is written to be, stood up away from the address the session is
// served on. The words are read here and written out where the app can load
// them, which is the same way a page in the project is drawn, so nothing on a
// page anybody sent is ever running inside the session.
//
// It is read whole, where the same file read as text is cut. There is no file on
// this machine to fall back to, and a page cut anywhere is not a shorter page, so
// the head of one is nothing worth standing up. What holds the size is the crew's
// own limit on what may be sent at all.
const whole = (bytes: ArrayBuffer) => readText(bytes, Infinity)

export default function PagePreview({ id, url }: { id: string; url: string }) {
  const { data, failed } = useRead(url, whole)
  if (failed) return <Failed label="Could not read this file" />
  if (!data) return <Loading />
  return <HtmlView id={id} path="" text={data.text} />
}
