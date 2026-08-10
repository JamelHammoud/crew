import { createServer, type Server } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import {
  EDIT_BRIEF,
  EDIT_LIMIT,
  edited,
  editModels,
  editSaid
} from '../src/shared/scribeEdit'
import { cleanSettings, editorOf } from '../src/shared/scribe'
import { tidy, TIDY_RULES, type ScribeChunk } from '../src/shared/scribeTidy'
import { ScribeFlow } from '../src/shared/scribeLive'

interface Asked {
  path: string
  brief: string
  said: string
  model: string
  streamed: unknown
}

interface Fake {
  url: string
  asked: Asked[]
  close: () => Promise<void>
}

type Answer = (said: string) => { status?: number; body?: unknown; wait?: number }

async function fakeModel(answer: Answer, models: string[] = ['a-model']): Promise<Fake> {
  const asked: Asked[] = []
  const server: Server = createServer((req, res) => {
    if (req.url === '/v1/models') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ data: models.map(id => ({ id })) }))
      return
    }
    if (req.url !== '/v1/chat/completions') {
      res.writeHead(404).end()
      return
    }
    let body = ''
    req.on('data', part => (body += part))
    req.on('end', () => {
      const sent = JSON.parse(body)
      const said = sent.messages[1]?.content ?? ''
      asked.push({
        path: req.url ?? '',
        brief: sent.messages[0]?.content ?? '',
        said,
        model: sent.model,
        streamed: sent.stream
      })
      const held = answer(said)
      const write = () => {
        res.writeHead(held.status ?? 200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(held.body ?? { choices: [{ message: { content: '' } }] }))
      }
      if (held.wait) setTimeout(write, held.wait)
      else write()
    })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as { port: number }).port
  return {
    url: `http://127.0.0.1:${port}`,
    asked,
    close: () => new Promise<void>(resolve => void server.close(() => resolve()))
  }
}

const wrote = (content: string) => ({ body: { choices: [{ message: { content } }] } })

let fake: Fake | null = null

afterEach(async () => {
  await fake?.close()
  fake = null
})

describe('what a model is allowed to have written', () => {
  const said = 'I still need to review the data. Update the presentation. And send everything to the team.'
  const meant = 'I still need to review the data, update the presentation, and send everything to the team.'

  it('takes the sentence the pauses had cut into four', () => {
    expect(edited(said, meant)).toBe(meant)
  })

  it('takes a time, an amount and a quarter written the way they are typed', () => {
    expect(edited('meet me at four thirty', 'Meet me at 4:30.')).toBe('Meet me at 4:30.')
    expect(
      edited(
        'the total was one thousand two hundred forty seven dollars and eighty three cents',
        'The total was $1,247.83.'
      )
    ).toBe('The total was $1,247.83.')
    expect(edited('quarter three revenue was up twelve point seven percent', 'Q3 revenue was up 12.7%.')).toBe(
      'Q3 revenue was up 12.7%.'
    )
  })

  it('takes an acronym list and a technology capitalized properly', () => {
    expect(edited('the ceo asked the it team to review the api crm and vpn settings', 'The CEO asked the IT team to review the API, CRM, and VPN settings.')).toBe(
      'The CEO asked the IT team to review the API, CRM, and VPN settings.'
    )
  })

  it('cuts a preamble off its own line', () => {
    expect(edited(said, `Here is the cleaned up text:\n\n${meant}`)).toBe(meant)
  })

  it('cuts a preamble that shares nothing but the small words', () => {
    expect(edited(said, `Sure, here is the text for you:\n${meant}`)).toBe(meant)
  })

  it('refuses a preamble it cannot cut off', () => {
    expect(edited('open the file', 'Sure, here is your cleaned up text: Open the file.')).toBe(null)
  })

  it('takes the words out of a fence', () => {
    expect(edited(said, `\`\`\`\n${meant}\n\`\`\``)).toBe(meant)
  })

  it('takes the quotation marks off the whole of it', () => {
    expect(edited('open the file', '"Open the file."')).toBe('Open the file.')
  })

  it('takes a model that thinks out loud on its way to the answer', () => {
    expect(edited('open the file', '<think>The speaker paused. No full stop there.</think>\nOpen the file.')).toBe(
      'Open the file.'
    )
    expect(edited('open the file', 'Reasoning about it.</think> Open the file.')).toBe('Open the file.')
  })

  it('refuses an answer to the words rather than an edit of them', () => {
    expect(edited('what time are we supposed to meet tomorrow', 'You have nothing on your calendar tomorrow.')).toBe(
      null
    )
  })

  it('refuses a refusal', () => {
    expect(edited('open the file', "I'm sorry, I can't help with that.")).toBe(null)
  })

  it('refuses a sentence it made longer', () => {
    expect(
      edited('ship the fix', 'Ship the fix as soon as the tests are green and let the rest of the team know.')
    ).toBe(null)
  })

  it('refuses an answer that dropped what was said', () => {
    expect(edited('draw the rows and then the header and then the footer', 'Draw the rows.')).toBe(null)
  })

  it('takes a correction, which throws a clause away on purpose', () => {
    const said = 'Schedule it for tuesday at three, actually make that wednesday at four thirty.'
    expect(edited(said, 'Schedule it for Wednesday at 4:30.')).toBe('Schedule it for Wednesday at 4:30.')
    expect(edited('I will meet you thursday, sorry, friday.', "I'll meet you Friday.")).toBe("I'll meet you Friday.")
  })

  it('does not read a correction as leave to drop the whole of it', () => {
    const said = 'Schedule it for tuesday at three, actually make that wednesday at four thirty.'
    expect(edited(said, 'Wednesday.')).toBe(null)
  })

  it('refuses a note left on the end', () => {
    expect(edited('open the file', 'Open the file. (I fixed the punctuation for you.)')).toBe(null)
  })

  it('refuses nothing at all', () => {
    expect(edited('open the file', '')).toBe(null)
    expect(edited('open the file', '   \n  ')).toBe(null)
  })

  it('says nothing about a stretch nobody spoke in', () => {
    expect(edited('', 'Anything at all.')).toBe(null)
  })

  it('keeps a name it does not know', () => {
    expect(edited('ask nguyen about the branch', 'Ask Nguyen about the branch.')).toBe(
      'Ask Nguyen about the branch.'
    )
  })

  it('leaves a swapped word to the model, since no rule here can see one', () => {
    expect(edited('their manager said the equipment is there', 'The manager said the equipment is there.')).toBe(
      'The manager said the equipment is there.'
    )
  })
})

describe('the brief a model is edited by', () => {
  it('says the one thing that has to be said, which is to answer with the text alone', () => {
    expect(EDIT_BRIEF).toMatch(/Return only that text/)
    expect(EDIT_BRIEF).toMatch(/No preamble/)
  })

  it('is written the way everything else here is written', () => {
    expect(EDIT_BRIEF).not.toMatch(/—/)
  })
})

describe('reading a dictation again against a real server', () => {
  it('sends the brief and the words, whole rather than streamed', async () => {
    fake = await fakeModel(() => wrote('Open the file.'))
    const out = await editSaid('open the file', { url: fake.url, model: 'a-model' })
    expect(out).toBe('Open the file.')
    expect(fake.asked).toHaveLength(1)
    expect(fake.asked[0].path).toBe('/v1/chat/completions')
    expect(fake.asked[0].brief).toBe(EDIT_BRIEF)
    expect(fake.asked[0].said).toBe('open the file')
    expect(fake.asked[0].model).toBe('a-model')
    expect(fake.asked[0].streamed).toBe(false)
  })

  it('keeps the path an address was written with', async () => {
    fake = await fakeModel(() => wrote('Open the file.'))
    await editSaid('open the file', { url: `${fake.url}/v1`, model: 'a-model' })
    expect(fake.asked[0].path).toBe('/v1/chat/completions')
  })

  it('writes what the rules wrote when the answer cannot be believed', async () => {
    fake = await fakeModel(() => wrote('I have no idea what you are asking me about.'))
    expect(await editSaid('Open the file.', { url: fake.url, model: 'a-model' })).toBe('Open the file.')
  })

  it('writes what the rules wrote when the server turns it away', async () => {
    fake = await fakeModel(() => ({ status: 500, body: { error: 'gone' } }))
    expect(await editSaid('Open the file.', { url: fake.url, model: 'a-model' })).toBe('Open the file.')
  })

  it('writes what the rules wrote when nothing is running there', async () => {
    expect(await editSaid('Open the file.', { url: 'http://127.0.0.1:1', model: 'a-model' })).toBe('Open the file.')
  })

  it('writes what the rules wrote when the answer never comes', async () => {
    fake = await fakeModel(() => ({ ...wrote('Too late.'), wait: 2000 }))
    const giveUp = AbortSignal.timeout(120)
    expect(await editSaid('Open the file.', { url: fake.url, model: 'a-model' }, giveUp)).toBe('Open the file.')
  })

  it('never asks about a stretch there is no model for', async () => {
    fake = await fakeModel(() => wrote('Open the file.'))
    expect(await editSaid('Open the file.', { url: fake.url, model: '' })).toBe('Open the file.')
    expect(await editSaid('Open the file.', { url: '', model: 'a-model' })).toBe('Open the file.')
    expect(fake.asked).toHaveLength(0)
  })

  it('never asks about a paragraph of speech', async () => {
    fake = await fakeModel(() => wrote('Short.'))
    const long = 'and on it went '.repeat(Math.ceil(EDIT_LIMIT / 15) + 1)
    expect(await editSaid(long, { url: fake.url, model: 'a-model' })).toBe(long)
    expect(fake.asked).toHaveLength(0)
  })

  it('says which models a server will serve', async () => {
    fake = await fakeModel(() => wrote(''), ['qwen3:4b', 'llama3.2'])
    expect(await editModels(fake.url)).toEqual(['llama3.2', 'qwen3:4b'])
  })

  it('says nothing about a server that is not running', async () => {
    expect(await editModels('http://127.0.0.1:1')).toEqual([])
    expect(await editModels('')).toEqual([])
  })
})

describe('a dictation written as it is said, read again on the way out', () => {
  const heard = (text: string, start: number, end: number): ScribeChunk[] => [{ text, start, end }]

  it('keeps the space in front of every stretch but the first', async () => {
    fake = await fakeModel(said => wrote(said.replace('.', '!')))
    const flow = new ScribeFlow()
    const editor = { url: fake.url, model: 'a-model' }
    const first = flow.mark(await editSaid(tidy(heard('open the file', 0, 1.4), TIDY_RULES), editor))
    const second = flow.mark(await editSaid(tidy(heard('then run the tests', 2.6, 4), TIDY_RULES), editor))
    expect(first).toBe('Open the file!')
    expect(second).toBe(' Then run the tests!')
  })

  it('hands the rules their own writing when there is no model to ask', async () => {
    const flow = new ScribeFlow()
    const editor = editorOf(cleanSettings({ edit: false }, 'darwin'))
    expect(flow.mark(await editSaid(tidy(heard('open the file', 0, 1.4), TIDY_RULES), editor))).toBe(
      'Open the file.'
    )
  })
})

describe('what the settings hand the editor', () => {
  it('holds nothing while it is off, whatever is written down', () => {
    const settings = cleanSettings(
      { edit: false, editUrl: 'http://127.0.0.1:11434', editModel: 'a-model' },
      'darwin'
    )
    expect(editorOf(settings)).toEqual({ url: '', model: 'a-model' })
  })

  it('reads an address written without a scheme', () => {
    const settings = cleanSettings({ edit: true, editUrl: '127.0.0.1:11434' }, 'darwin')
    expect(editorOf(settings).url).toBe('http://127.0.0.1:11434')
  })

  it('holds no address it cannot read', () => {
    expect(cleanSettings({ editUrl: 'what' }, 'darwin').editUrl).toBe('http://what')
    expect(cleanSettings({ editUrl: '   ' }, 'darwin').editUrl).toBe('')
  })

  it('is off on a machine that has never been asked', () => {
    const settings = cleanSettings(null, 'darwin')
    expect(settings.edit).toBe(false)
    expect(settings.editModel).toBe('')
    expect(editorOf(settings).url).toBe('')
  })
})
