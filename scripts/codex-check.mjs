import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const TASK =
  'Read notes.txt. Then add a line saying "third" to the end of it. Then run the command `ls -la`. Then reply with the single word Done.'

async function provider(dir) {
  const file = path.join(dir, 'codex.mjs')
  await build({
    entryPoints: [path.join(root, 'src/runner/providers/codex.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    packages: 'external',
    outfile: file,
    logLevel: 'error'
  })
  return import(file)
}

const dir = await mkdtemp(path.join(tmpdir(), 'crew-codex-'))
const work = path.join(dir, 'work')
try {
  await mkdir(work, { recursive: true })
  await writeFile(path.join(work, 'notes.txt'), 'first\nsecond\n')

  const { codexProvider } = await provider(dir)
  if (!(await codexProvider.detect())) {
    console.error('this check needs the codex CLI on PATH')
    process.exit(1)
  }

  const started = Date.now()
  const steps = []
  const at = () => ((Date.now() - started) / 1000).toFixed(2).padStart(6)
  let firstThought = 0
  let firstWord = 0

  const run = codexProvider.start(TASK, work, {
    onStep: step => {
      steps.push(step)
      if (step.kind === 'thinking' && step.text && !firstThought) firstThought = Date.now() - started
      if (step.kind === 'text' && step.text && !firstWord) firstWord = Date.now() - started
      if (step.kind === 'thinking' && step.text) console.log(`${at()} thinking  ${step.text.slice(0, 70)}`)
      else if (step.kind === 'text' && step.text) process.stdout.write(step.text)
      else if (step.name) {
        const files = step.files?.map(f => `${f.path} +${f.added}/-${f.removed}`).join(', ')
        console.log(
          `${at()} ${step.status.padEnd(7)} ${step.name.padEnd(11)} ${step.detail ?? ''}${files ? ` [${files}] ` : ''}`
        )
      }
    },
    onTokens: () => {}
  })

  const result = await run.done
  console.log(`\n${at()} answer: ${result.text.trim().slice(0, 200)}`)

  const notes = await readFile(path.join(work, 'notes.txt'), 'utf8')
  const named = new Set(steps.map(s => s.name).filter(Boolean))
  const withDiff = steps.filter(s => s.files?.some(f => f.diff))
  const thinking = steps.filter(s => s.kind === 'thinking' && s.text)
  const streamedText = steps.filter(s => s.kind === 'text' && s.status === 'running')

  const missing = []
  if (!thinking.length) missing.push('no reasoning came through at all')
  if (!streamedText.length) missing.push('the answer never streamed, it only arrived whole')
  if (!withDiff.length) missing.push('no step carried a diff')
  if (!withDiff.some(s => s.files.some(f => f.added > 0)))
    missing.push('a diff came through with nothing counted in it')
  if (!notes.includes('third')) missing.push('the file was never really changed')
  if (named.has('Shell') === false) missing.push('no command was named as one')

  console.log(`\nnamed:    ${[...named].join(', ')}`)
  console.log(`thinking: ${thinking.length} stretches, first at ${(firstThought / 1000).toFixed(2)}s`)
  console.log(`answer:   ${streamedText.length} chunks, first at ${(firstWord / 1000).toFixed(2)}s`)
  console.log(
    `diffs:    ${withDiff
      .flatMap(s => s.files)
      .map(f => `${f.path} +${f.added}/-${f.removed}`)
      .join(', ')}`
  )

  if (missing.length) {
    console.error(`\n${missing.join('\n')}`)
    process.exit(1)
  }
  console.log('\nlive thinking, a streamed answer, named commands and a counted diff, off the real CLI')
} catch (error) {
  console.error(`the run fell over: ${error.message}`)
  process.exit(1)
} finally {
  await rm(dir, { recursive: true, force: true })
}
