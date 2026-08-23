import { mkdtemp, realpath, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const port = Number(process.env.CREW_AGENT_MOTION_PORT ?? 4317)

const probe = `
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import AgentIcon from ${JSON.stringify(path.join(root, 'src/renderer/src/components/AgentIcon'))}

const activities = [
  ['thinking', 'Thinking'],
  ['reading', 'Reading'],
  ['searching', 'Searching'],
  ['editing', 'Writing'],
  ['designing', 'Designing'],
  ['running', 'Running'],
  ['planning', 'Planning'],
  ['communicating', 'Communicating'],
  ['acting', 'Acting']
]

function Sample({ activity, label, index }) {
  return (
    <article className="rounded-card border border-ink-700 bg-ink-800/70 px-6 py-7 flex flex-col items-center gap-5">
      <AgentIcon seed={'motion-' + index} px={96} activity={activity} />
      <div className="flex items-center gap-3">
        <AgentIcon seed={'motion-' + index} size="sm" activity={activity} />
        <span className="text-sm font-semibold text-fg">{label}</span>
      </div>
    </article>
  )
}

function Transition() {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setIndex(value => (value + 1) % activities.length), 2000)
    return () => clearInterval(timer)
  }, [])
  const [activity, label] = activities[index]
  return (
    <section className="rounded-card border border-ink-700 bg-ink-800/70 px-8 py-7 flex items-center gap-7">
      <AgentIcon seed="motion-transition" px={112} activity={activity} />
      <div>
        <div className="text-lg font-semibold text-fg">State transition</div>
        <div className="mt-1 text-sm text-fg/55">{label}</div>
      </div>
    </section>
  )
}

function App() {
  return (
    <main className="min-h-screen bg-ink-900 text-fg px-10 py-10">
      <div className="mx-auto max-w-[1120px]">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <h1 className="text-lg font-semibold">Agent motion</h1>
            <p className="mt-1 text-sm text-fg/45">Large studies and the 28 px size used in Crew.</p>
          </div>
          <Transition />
        </div>
        <section className="grid grid-cols-3 gap-4">
          {activities.map(([activity, label], index) => (
            <Sample key={activity} activity={activity} label={label} index={index} />
          ))}
        </section>
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
`

const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-agent-motion-')))
await writeFile(
  path.join(dir, 'index.html'),
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/probe.css"><script type="module" src="/probe.jsx"></script></head><body class="mac"><div id="root"></div></body></html>'
)
await writeFile(path.join(dir, 'probe.jsx'), probe)
await writeFile(
  path.join(dir, 'probe.css'),
  `@import "${path.join(root, 'src/renderer/src/styles.css')}";\n@source "${path.join(root, 'src/renderer/src')}";\nhtml, body { margin: 0; min-height: 100%; background: #0b0b0d; }\n`
)

const { createServer } = await import('vite')
const tailwind = (await import('@tailwindcss/vite')).default
const server = await createServer({
  root: dir,
  server: { host: '127.0.0.1', port, strictPort: true },
  plugins: [tailwind()],
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: { react: path.join(root, 'node_modules/react'), 'react-dom': path.join(root, 'node_modules/react-dom') }
  }
})

await server.listen()
process.stdout.write(`http://127.0.0.1:${port}\n`)

const close = async () => {
  await server.close()
  process.exit(0)
}

process.on('SIGINT', close)
process.on('SIGTERM', close)
await new Promise(() => {})
