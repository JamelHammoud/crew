import { useState } from 'react'
import GeneratedField from '../art/GeneratedField'
import InsetRing from '../InsetRing'
import { PLUGIN_ART } from './pluginArt'

export default function PluginMark({ seed, box = 40 }: { seed: string; box?: number }) {
  const art = PLUGIN_ART[seed]
  const [failedArt, setFailedArt] = useState<string | null>(null)
  return (
    <span
      className="relative inline-block align-middle shrink-0 overflow-hidden rounded-[22%]"
      style={{ width: box, height: box }}
    >
      {art && failedArt !== art ? (
        <img
          src={art}
          alt=""
          draggable={false}
          className="w-full h-full object-cover"
          onError={() => setFailedArt(art)}
        />
      ) : (
        <GeneratedField seed={seed} box={box} />
      )}
      <InsetRing className="ring-1 ring-inset ring-fg/5" />
    </span>
  )
}
