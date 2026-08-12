import { useMemo } from 'react'
import ImageView from '../ImageView'
import { readText } from './bytes'
import { Failed, Loading } from './Frame'
import { useRead } from './useRead'

// A vector is a picture, so it is drawn as one rather than as a page. A picture
// in an image tag runs nothing and reaches nothing, which is what makes it the
// right way round for markup somebody else sent.
export default function VectorPreview({ url, name }: { url: string; name: string }) {
  const { data, failed } = useRead(url, readText)
  const src = useMemo(() => (data ? `data:image/svg+xml;utf8,${encodeURIComponent(data.text)}` : ''), [data])
  if (failed) return <Failed label="Could not read this file" />
  if (!data) return <Loading />
  return <ImageView src={src} alt={name} copyable={false} />
}
