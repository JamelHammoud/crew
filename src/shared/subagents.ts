import type { AgentSettings } from './llm'

// A subagent is a role: a name, a brief, and how it runs. It belongs to the
// crew the way a tool does, so everybody's agents get the same helpers. A run
// of one is an ordinary thread with a parent, which is what gives it steps,
// thinking, diffs, cancel and a place to be talked to without any of that
// having to be invented here.

export interface Subagent {
  id: string
  name: string
  brief: string
  // The CLI a run of this role would rather have. A role that names none runs
  // on whoever asked for it, which keeps the common case on one machine.
  provider?: string
  settings: AgentSettings
  createdBy: string
  ts: number
}

export const NAME_LIMIT = 24
export const BRIEF_LIMIT = 4000
export const SUBJECT_LIMIT = 80
export const TASK_LIMIT = 8000
export const MAX_SUBAGENTS = 40
export const SETTING_LIMIT = 12
export const SETTING_VALUE_LIMIT = 120

// How many may run at once under one parent, how many a parent thread may run
// through in its life, and how many times one may be woken by a helper coming
// back. Without the last of these a parent that spawns on every wake is a loop
// the crew watches burn tokens all afternoon.
export const FAN_LIMIT = 4
export const RUN_LIMIT = 16
export const WAKE_LIMIT = 8
export const DEPTH_LIMIT = 2

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

export const DEFAULT_PREFS: HelperPrefs = { on: true, fan: FAN_LIMIT }

export function cleanPrefs(prefs: Partial<HelperPrefs> | undefined | null): HelperPrefs {
  if (!prefs || typeof prefs !== 'object') return DEFAULT_PREFS
  const fan = typeof prefs.fan === 'number' && Number.isFinite(prefs.fan) ? Math.round(prefs.fan) : FAN_LIMIT
  return { on: prefs.on !== false, fan: Math.min(Math.max(1, fan), FAN_LIMIT) }
}

export interface SubagentDraft {
  name: string
  brief: string
  provider?: string
  settings: AgentSettings
}

function cleanSettings(settings: AgentSettings | undefined): AgentSettings {
  if (!settings || typeof settings !== 'object') return {}
  const out: AgentSettings = {}
  for (const [key, value] of Object.entries(settings)) {
    if (Object.keys(out).length >= SETTING_LIMIT) break
    if (typeof value !== 'string') continue
    const name = key.trim().slice(0, NAME_LIMIT)
    if (!name) continue
    out[name] = value.trim().slice(0, SETTING_VALUE_LIMIT)
  }
  return out
}

// What arrives over the wire is whatever the other end sent, so a role is only
// as good as this. One with no name, or nothing to say what it is for, is not a
// role and comes back as null rather than as a helper that sits there with
// nothing to do.
export function cleanSubagent(
  name: string,
  brief: string,
  opts: { provider?: string; settings?: AgentSettings } = {}
): SubagentDraft | null {
  const cleanName = typeof name === 'string' ? name.trim().slice(0, NAME_LIMIT) : ''
  const cleanBrief = typeof brief === 'string' ? brief.trim().slice(0, BRIEF_LIMIT) : ''
  if (!cleanName || !cleanBrief) return null
  const provider = typeof opts.provider === 'string' ? opts.provider.trim().slice(0, NAME_LIMIT) : ''
  return {
    name: cleanName,
    brief: cleanBrief,
    ...(provider ? { provider } : {}),
    settings: cleanSettings(opts.settings)
  }
}

// A role is named by a model rather than picked from a list, so it is found by
// whatever the model wrote: the id it was given, or the name as a person reads
// it, however it happens to be capitalised.
export function findSubagent(roles: readonly Subagent[], named: string): Subagent | undefined {
  const asked = typeof named === 'string' ? named.trim().toLowerCase() : ''
  if (!asked) return undefined
  return roles.find(role => role.id.toLowerCase() === asked) ?? roles.find(role => role.name.toLowerCase() === asked)
}

export const SUBAGENT_INSTRUCTIONS = [
  `You are a helper on one piece of work, handed to you by another agent.`,
  `Do that piece and nothing around it. Nobody is reading over your shoulder, so there is no conversation to keep up and no summary of what you are about to do.`,
  `Answer with what you found or what you changed, in a few lines. That answer goes back to whoever sent you, so write it for them: findings, file paths, and anything that turned out differently from the task as it was worded.`,
  `Do not send out helpers of your own unless the task says to.`
].join('\n')

const SPAWN_ROOM = (room: number): string =>
  room > 0
    ? `You can have ${room} more running at once.`
    : `You have as many running as you can have at once. Wait for one to come back before sending another.`

// The words a parent is given. They are written here rather than on the host
// because only the machine running the agent knows the address it reaches the
// session at, which is the same reason the design board's own preamble is
// written where it is.
export function subagentPreamble(
  apiBase: string,
  promptId: string,
  roles: readonly Subagent[],
  room: number
): string | null {
  if (roles.length === 0) return null
  return [
    `## Helpers`,
    ``,
    `You can send work out to helpers and keep working while they do it. Each one runs on a real machine here, in this project, on its own.`,
    ``,
    `The roles you have:`,
    ...roles.map(role => `  ${role.name} — ${role.brief.split('\n')[0]}`),
    ``,
    `Send one out:`,
    `  curl -s -X POST ${apiBase}/agents/spawn -H 'content-type: application/json' -d '{"promptId":"${promptId}","role":"${roles[0].name}","subject":"What it is doing, in a few words","task":"The whole of what it should do, written as if to somebody who cannot see this thread."}'`,
    `That returns an id straight away. It does not wait.`,
    ``,
    `Then carry on with your own work. When a helper finishes, its answer arrives in the middle of what you are doing, the way a message from a person does. You do not poll for it and you do not have to stop.`,
    ``,
    `Say something to one that is still going:`,
    `  curl -s -X POST ${apiBase}/agents/<id>/say -H 'content-type: application/json' -d '{"promptId":"${promptId}","text":"..."}'`,
    `Read where one has got to:`,
    `  curl -s ${apiBase}/agents/<id>`,
    `Stop one:`,
    `  curl -s -X POST ${apiBase}/agents/<id>/stop -H 'content-type: application/json' -d '{"promptId":"${promptId}"}'`,
    ``,
    `If you have nothing of your own left to do and would rather park than poll:`,
    `  curl -s -X POST ${apiBase}/agents/wait -H 'content-type: application/json' -d '{"promptId":"${promptId}","ids":["<id>"],"ms":${WAIT_MS}}'`,
    `It comes back after ${Math.round(WAIT_MS / 1000)} seconds whether or not they are done. Prefer working over waiting.`,
    ``,
    `How to use them:`,
    `  Send out work that does not sit on the files you are holding. Two agents editing one file at the same time is the one thing nothing here can merge.`,
    `  Write the task in full. A helper cannot see this thread, the messages in it, or what you have already worked out.`,
    `  Say in one line who you sent where, then get on with your own part. Do not narrate what they are doing: that is already on the screen beside your words.`,
    `  ${SPAWN_ROOM(room)}`,
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
