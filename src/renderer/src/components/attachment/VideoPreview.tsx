import { useState } from 'react'
import { Failed } from './Frame'

export default function VideoPreview({ url }: { url: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <Failed label="Could not play this file" />
  return (
    <div className="absolute inset-0 flex items-center justify-center p-4">
      <video
        src={url}
        controls
        onError={() => setFailed(true)}
        className="max-w-full max-h-full rounded-card bg-black"
      />
    </div>
  )
}
