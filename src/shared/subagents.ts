// A helper is one piece of work an agent hands out while it carries on with
// its own. Nothing about one is written down in advance: the agent names it,
// writes the whole of what it should do, and sends it out, so the shape of the
// work decides how it is divided rather than a list somebody wrote last week.
//
// A run of one is an ordinary Crew thread with a parent, which is what gives it
// steps, thinking, diffs, cancel and somewhere to be talked to without any of
// that having to be invented here.

export const NAME_LIMIT = 24
export const SUBJECT_LIMIT = 80
export const TASK_LIMIT = 8000

// How many may run at once under one parent, how many a parent thread may run
// through in its life, and how many times one may be woken by a helper coming
// back. Without the last of these a parent that spawns on every wake is a loop
// the crew watches burn tokens all afternoon.
export const FAN_LIMIT = 20
export const RUN_LIMIT = 80
export const WAKE_LIMIT = 40
export const DEPTH_LIMIT = 2

// What a machine runs at once before anybody says otherwise. The ceiling is how
// far the setting goes, not what a laptop should be asked to carry unasked.
export const DEFAULT_FAN = 4

// The longest a parent may park on a wait, and the breath a run of returns is
// gathered over. Three helpers finishing together are one interruption, because
// three steers into a live turn is three times the model is pulled off what it
// was doing.
export const WAIT_MS = 60000
export const RETURN_COALESCE_MS = 1500

// What one person lets helpers do on their own machine. A helper runs a real
// CLI on somebody's laptop, and the person whose laptop it is pays for it in
// tokens and in what it does to their files, so this is theirs rather than the
// crew's: off means their agents never send work out and never take anybody
// else's, and the count is how many they will have going at once.
export interface HelperPrefs {
  on: boolean
  fan: number
}

export const DEFAULT_PREFS: HelperPrefs = { on: true, fan: DEFAULT_FAN }

export function cleanPrefs(prefs: Partial<HelperPrefs> | undefined | null): HelperPrefs {
  if (!prefs || typeof prefs !== 'object') return DEFAULT_PREFS
  const fan = typeof prefs.fan === 'number' && Number.isFinite(prefs.fan) ? Math.round(prefs.fan) : DEFAULT_FAN
  return { on: prefs.on !== false, fan: Math.min(Math.max(1, fan), FAN_LIMIT) }
}

// The name a helper was sent out under. A model writes it, so it is only as
// good as this: one that arrives empty is given the one word that is always
// true rather than a nameless chip.
export function cleanHelperName(name: unknown): string {
  const clean = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, NAME_LIMIT) : ''
  return clean || 'Helper'
}

export const SUBAGENT_INSTRUCTIONS = [
  `You are a helper on one piece of work, handed to you by another agent.`,
  `Do that piece and nothing around it. Nobody is reading over your shoulder, so there is no conversation to keep up and no summary of what you are about to do.`,
  `Answer with what you found or what you changed, in a few lines. That answer goes back to whoever sent you, so write it for them: findings, file paths, and anything that turned out differently from the task as it was worded.`,
  `Do not send out helpers of your own unless the task says to.`
].join('\n')

const room = (left: number): string =>
  left > 0
    ? `You can have ${left} more running at once.`
    : `You have as many running as you can have at once. Wait for one to come back before sending another.`

// The words a parent is given. They are written here rather than on the host
// because only the machine running the agent knows the address it reaches the
// session at, which is the same reason the design board's own preamble is
// written where it is.
export function subagentPreamble(apiBase: string, promptId: string, left: number, providers: string[] = []): string | null {
  if (left <= 0) return null
  return [
    `## Helpers`,
    ``,
    `You can split work off to a helper and keep going while it runs. A helper is a real agent on a real machine here, in this project, working on its own. You make one up as you need it: give it a short name and the whole of what it should do.`,
    ``,
    `  curl -s -X POST ${apiBase}/agents/spawn -H 'content-type: application/json' -d '{"promptId":"${promptId}","name":"Scout","subject":"reading the schema","task":"Find every table in the schema and list them with their columns. Do not change anything."}'`,
    ``,
    `That returns an id straight away. It does not wait.`,
    ...(providers.length > 0
      ? [``, `Add "provider" to run it on a particular CLI: ${providers.join(', ')}. Add "model" to pin the model. Leave both out and it runs where you are.`]
      : []),
    ``,
    `Then carry on with your own work. When a helper finishes, its answer arrives in the middle of what you are doing, the way a message from a person does. You do not poll for it and you do not have to stop.`,
    ``,
    `Say something to one that is still going:`,
    `  curl -s -X POST ${apiBase}/agents/<id>/say -H 'content-type: application/json' -d '{"promptId":"${promptId}","text":"..."}'`,
    `Read where one has got to:`,
    `  curl -s ${apiBase}/agents/<id>?promptId=${promptId}`,
    `Stop one:`,
    `  curl -s -X POST ${apiBase}/agents/<id>/stop -H 'content-type: application/json' -d '{"promptId":"${promptId}"}'`,
    ``,
    `If you have nothing of your own left to do and would rather park than poll:`,
    `  curl -s -X POST ${apiBase}/agents/wait -H 'content-type: application/json' -d '{"promptId":"${promptId}","ids":["<id>"],"ms":${WAIT_MS}}'`,
    `It comes back after ${Math.round(WAIT_MS / 1000)} seconds whether or not they are done. Prefer working over waiting.`,
    ``,
    `How to use them:`,
    `  Divide the work, do not hand it over whole. Send out the parts that can happen at the same time and keep one for yourself.`,
    `  Send out work that does not sit on the files you are holding. Two agents editing one file at the same time is the one thing nothing here can merge.`,
    `  Write the task in full. A helper cannot see this thread, the messages in it, or what you have already worked out.`,
    `  The name is what people see on the chip while it runs, so make it say what the helper is for: Scout, Auditor, Docs.`,
    `  Say in one line who you sent where, then get on with your own part. Do not narrate what they are doing: that is already on the screen beside your words.`,
    `  ${room(left)}`,
    `  Keep the promptId exactly as it is above. It is what says the work is yours.`
  ].join('\n')
}

export interface SubagentReturn {
  name: string
  subject: string
  ok: boolean
  ms: number
  text: string
}

const spell = (ms: number): string => {
  const seconds = Math.max(1, Math.round(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`
}

// What the parent reads when a helper comes back. The host writes the whole of
// it rather than the runner framing one, because a breath of returns arrives as
// one interruption and there is no single name to frame it under.
export function returnText(finished: readonly SubagentReturn[], stillOut: readonly string[]): string {
  const lines = finished.map(one =>
    one.ok
      ? [`${one.name} finished after ${spell(one.ms)} and said:`, one.text.trim() || '(nothing)']
      : [`${one.name} stopped after ${spell(one.ms)} without finishing:`, one.text.trim() || '(no reason given)']
  )
  const out = lines.flatMap((pair, index) => (index === 0 ? pair : ['', ...pair]))
  if (stillOut.length > 0) {
    out.push('', stillOut.length === 1 ? `${stillOut[0]} is still going.` : `${stillOut.join(' and ')} are still going.`)
  }
  return out.join('\n')
}
