import Emoji from '../Emoji'

const MAKERS = [
  { name: 'Jamel', url: 'https://github.com/JamelHammoud' },
  { name: 'Ali', url: 'https://github.com/alihammoud21' }
]

const LINK =
  'text-fg/70 underline underline-offset-2 decoration-fg/30 transition-colors hover:text-fg hover:decoration-fg'

function Maker({ name, url }: { name: string; url: string }) {
  return (
    <button onClick={() => void window.crew.openExternal(url)} className={LINK}>
      {name}
    </button>
  )
}

export default function MadeBy() {
  return (
    <p className="pt-8 text-sm text-fg/45 select-text">
      Made with <Emoji char="❤️" size="1.15em" className="align-[-0.2em]" />
      <span className="sr-only">❤️</span> by <Maker {...MAKERS[0]} /> and <Maker {...MAKERS[1]} />
    </p>
  )
}
