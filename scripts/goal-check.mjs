import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const ASK = 'Add a line saying "third" to the end of notes.txt, then reply with the single word Done.'
const CONDITION = 'notes.txt ends with a line saying "fourth"'

async function bundled(dir, from, name) {
  const file = path.join(dir, name)
  await build({
    entryPoints: [path.join(root, from)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    packages: 'external',
    outfile: file,
    logLevel: 'error'
  })
  return import(file)
}

const dir = await mkdtemp(path.join(tmpdir(), 'crew-goal-'))
const work = path.join(dir, 'work')
try {
  await mkdir(work, { recursive: true })
  await writeFile(path.join(work, 'notes.txt'), 'first\nsecond\n')

  const { claudeProvider } = await bundled(dir, 'src/runner/providers/claude.ts', 'claude.mjs')
  const { subagentPreamble } = await bundled(dir, 'src/shared/subagents.ts', 'subagents.mjs')
  const { pagePreamble } = await bundled(dir, 'src/shared/showPage.ts', 'page.mjs')
  const { ticketPreamble } = await bundled(dir, 'src/shared/tickets.ts', 'tickets.mjs')
  if (!(await claudeProvider.detect())) {
    console.error('this check needs the claude CLI on PATH')
    process.exit(1)
  }

  const base = 'http://127.0.0.1:1'
  const id = '00000000-0000-4000-8000-000000000000'
  const prompt = [
    `You are an agent in a shared project.\n\nThread so far:\nSam: ${ASK}`,
    subagentPreamble(base, id, 6, ['claude']) ?? '',
    pagePreamble(base, id),
    ticketPreamble(base, id)
  ]
    .filter(Boolean)
    .join('\n\n')

  const started = Date.now()
  const at = () => ((Date.now() - started) / 1000).toFixed(2).padStart(6)
  const steps = []
  const run = claudeProvider.start(
    prompt,
    work,
    {
      onStep: step => {
        steps.push(step)
        if (step.kind === 'text' && step.text) process.stdout.write(step.text)
        else if (step.name) console.log(`${at()} ${step.status.padEnd(7)} ${step.name.padEnd(11)} ${step.detail ?? ''}`)
      },
      onTokens: () => {}
    },
    {},
    { goal: CONDITION }
  )

  const result = await run.done
  const notes = await readFile(path.join(work, 'notes.txt'), 'utf8')
  const said = steps
    .map(step => step.text ?? '')
    .concat(result.text ?? '')
    .join('\n')

  const missing = []
  if (/limited to \d+ characters/i.test(said)) missing.push('the CLI read the whole prompt as the condition and refused it')
  if (!/goal/i.test(said)) missing.push('nothing in the run mentions a goal, so the condition never landed')
  if (!notes.includes('third')) missing.push('the file was never really changed')

  console.log(`\nprompt:    ${prompt.length} characters`)
  console.log(`condition: ${ASK.length} characters`)
  console.log(`answer:    ${(result.text ?? '').trim().slice(0, 200)}`)

  if (missing.length) {
    console.error(`\n${missing.join('\n')}`)
    process.exit(1)
  }
  console.log('\nthe goal was set from what the person wrote, the run did the work, off the real CLI')
} catch (error) {
  console.error(`the run fell over: ${error.message}`)
  process.exit(1)
} finally {
  await rm(dir, { recursive: true, force: true })
}
