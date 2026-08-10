import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const ENTRY = [
  "export { editSaid, edited, editModels, EDIT_BRIEF } from './src/shared/scribeEdit'",
  "export { tidy, TIDY_RULES } from './src/shared/scribeTidy'",
  "export { LOCAL_URLS, serverUrl } from './src/shared/modelServers'"
].join('\n')

const WORD = 0.3
const BEAT = 0.05

const CASES = [
  {
    spoken: 'i still need to review the data [0.9] update the presentation [0.9] and send everything to the team',
    wants: [
      ['one sentence rather than four', text => !/data\.\s/i.test(text) && (text.match(/[.!?]/g) ?? []).length <= 1]
    ]
  },
  {
    spoken: 'lets meet at four thirty',
    wants: [['a time with a colon in it', text => /4:30/.test(text)]]
  },
  {
    spoken: 'the total was one thousand two hundred forty seven dollars and eighty three cents',
    wants: [['an amount written as money', text => /\$1,247\.83/.test(text)]]
  },
  {
    spoken: 'quarter three revenue was up twelve point seven percent',
    wants: [
      ['a quarter written as Q3', text => /\bQ3\b/.test(text)],
      ['a percentage written with its sign', text => /12\.7%/.test(text)]
    ]
  },
  {
    spoken: 'the ceo asked the it team to review the api crm and vpn settings',
    wants: [
      ['the acronyms in capitals', text => /\bCEO\b/.test(text) && /\bAPI\b/.test(text) && /\bVPN\b/.test(text)],
      ['the list punctuated', text => /API,\s*CRM/i.test(text)]
    ]
  },
  {
    spoken: 'schedule it for tuesday at three [0.5] actually make that wednesday at four thirty',
    wants: [
      ['the correction settled', text => /wednesday/i.test(text) && !/tuesday/i.test(text)],
      ['the time it settled on', text => /4:30/.test(text)]
    ]
  },
  {
    spoken: 'their manager said theyre going to leave their equipment over there',
    wants: [['their kept rather than swapped for the', text => /^their\b/i.test(text.trim())]]
  },
  {
    spoken: 'im probably just gonna stay home',
    wants: [['the voice left alone', text => /gonna/i.test(text) && !/\bwill\b/i.test(text)]]
  },
  {
    spoken: 'i kind of like the new design',
    wants: [['kind of kept where it carries meaning', text => /kind of/i.test(text)]]
  }
]

async function load(dir) {
  const file = path.join(dir, 'scribe-edit.mjs')
  await build({
    stdin: { contents: ENTRY, resolveDir: root, sourcefile: 'scribe-edit-check.ts', loader: 'ts' },
    bundle: true,
    format: 'esm',
    platform: 'node',
    packages: 'external',
    outfile: file,
    logLevel: 'error'
  })
  return import(file)
}

function heard(line) {
  const chunks = []
  let clock = 0
  let gap = 0
  for (const token of line.split(/\s+/)) {
    if (!token) continue
    const pause = /^\[([0-9.]+)\]$/.exec(token)
    if (pause) {
      gap = Number(pause[1])
      continue
    }
    clock += gap
    chunks.push({ text: token, start: clock, end: clock + WORD })
    clock += WORD
    gap = BEAT
  }
  return chunks
}

async function serving(app) {
  const written = process.env.CREW_LOCAL_URL?.trim() ? app.serverUrl(process.env.CREW_LOCAL_URL) : null
  for (const url of [...(written ? [written] : []), ...app.LOCAL_URLS]) {
    const models = await app.editModels(url)
    if (models.length) return { url, models }
  }
  return null
}

async function check(app) {
  const found = await serving(app)
  if (!found) {
    console.log(`nothing on this computer is serving models at ${app.LOCAL_URLS.join(', ')}`)
    console.log('there was no model to read a dictation back, so nothing was checked')
    return
  }

  const model = process.env.CREW_LOCAL_MODEL?.trim() || found.models[0]
  const editor = { url: found.url, model }
  console.log(`server:   ${found.url}`)
  console.log(`model:    ${model}`)
  console.log(`brief:    ${app.EDIT_BRIEF.length} characters\n`)

  const checks = []
  let refused = 0

  for (const one of CASES) {
    const rules = app.tidy(heard(one.spoken), app.TIDY_RULES)
    const started = Date.now()
    const out = await app.editSaid(rules, editor)
    const took = ((Date.now() - started) / 1000).toFixed(2)
    const same = out === rules
    if (same) refused += 1
    console.log(`spoken:   ${one.spoken}`)
    console.log(`rules:    ${rules}`)
    console.log(`written:  ${out}${same ? '   (unchanged)' : ''}`)
    console.log(`took:     ${took}s\n`)
    for (const [name, holds] of one.wants) {
      checks.push({ name, ok: holds(out), note: out })
    }
  }

  for (const one of checks) console.log(`${one.ok ? 'PASS' : 'FAIL'}  ${one.name}\n      ${one.note}`)

  const failed = checks.filter(one => !one.ok)
  console.log(
    `\n${checks.length - failed.length} of ${checks.length} held, and ${refused} of ${CASES.length} came back unchanged`
  )
  if (failed.length) {
    console.error(`\n${failed.length} of ${checks.length} checks failed off the real model, which is the model rather than the code`)
  } else {
    console.log('\nsentences, times, amounts, acronyms, a correction and a voice left alone, off a real model on this computer')
  }
}

const dir = await mkdtemp(path.join(tmpdir(), 'crew-scribe-edit-'))
try {
  await check(await load(dir))
} catch (error) {
  console.error(`the check fell over: ${error.message}`)
  process.exitCode = 1
} finally {
  await rm(dir, { recursive: true, force: true })
}
