import GeneratedField from '../art/GeneratedField'
import InsetRing from '../InsetRing'

export default function PluginMark({ seed, box = 40 }: { seed: string; box?: number }) {
  return (
    <span
      className="relative inline-block align-middle shrink-0 overflow-hidden rounded-[22%]"
      style={{ width: box, height: box }}
    >
      <GeneratedField seed={seed} box={box} />
      <InsetRing className="ring-1 ring-inset ring-fg/5 rounded-[22%]" />
    </span>
  )
}
