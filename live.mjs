import { build } from 'esbuild'
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const out = '/tmp/kimiprobe/bundle.mjs'
await build({ entryPoints: ['/tmp/kimiprobe/entry.ts'], bundle: true, platform: 'node', format: 'esm', outfile: out, packages: 'external' })
const { kimiProvider } = await import(out + '?' + Date.now())

const dir = await mkdtemp(path.join(tmpdir(), 'kimi-live-'))
await writeFile(path.join(dir, 'math.js'), 'export function add(a, b) {\n  return a - b\n}\n')

const tokens = []
const steps = []
const run = kimiProvider.start(
  'Read math.js, think about whether add() is right, and fix it with an edit.',
  dir,
  { onStep: s => steps.push(s), onTokens: (t, c) => tokens.push([t, c]) },
  {}
)
const killer = setTimeout(() => run.kill(), 240000)
try {
  const done = await run.done
  clearTimeout(killer)
  const kinds = {}
  for (const s of steps) kinds[s.kind] = (kinds[s.kind] ?? 0) + 1
  const files = steps.flatMap(s => s.files ?? [])
  console.log('steerable:', kimiProvider.steerable)
  console.log('step kinds:', JSON.stringify(kinds))
  console.log('thinking chars:', steps.filter(s => s.kind === 'thinking').map(s => s.text ?? '').join('').length)
  console.log('files changed:', JSON.stringify(files))
  console.log('token reports:', tokens.length, 'last:', JSON.stringify(tokens.at(-1)))
  console.log('max tokens seen:', Math.max(0, ...tokens.map(t => t[0])))
  console.log('file now:', (await readFile(path.join(dir, 'math.js'), 'utf8')).trim().replace(/\n\s*/g, ' '))
  console.log('answer:', done.text.slice(0, 120))
} catch (e) {
  console.log('FAILED:', e.message)
} finally {
  await rm(dir, { recursive: true, force: true })
}
