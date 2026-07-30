import { useState } from 'react'
import { Failed } from './Frame'

export default function AudioPreview({ url }: { url: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <Failed label="Could not play this file" />
  return (
    <div className="absolute inset-0 flex items-center justify-center p-4">
      <audio src={url} controls onError={() => setFailed(true)} className="w-full max-w-96" />
    </div>
  )
}
