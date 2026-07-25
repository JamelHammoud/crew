export default function ScrollFade({ edges }: { edges: { top: boolean; bottom: boolean } }) {
  return (
    <>
      <div
        className={`absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-ink-900 to-transparent pointer-events-none transition-opacity duration-200 ${edges.top ? 'opacity-0' : 'opacity-100'}`}
      />
      <div
        className={`absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-ink-900 to-transparent pointer-events-none transition-opacity duration-200 ${edges.bottom ? 'opacity-0' : 'opacity-100'}`}
      />
    </>
  )
}
