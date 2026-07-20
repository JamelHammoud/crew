import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AgentUsage, UsageWindow } from '../../shared/llm'

const FETCH_TIMEOUT_MS = 10000
// Only the newest few rollout files can hold the latest snapshot; scanning
// everything would grow unbounded with codex history.
const CODEX_FILE_LIMIT = 8
// A rate-limit snapshot sits near the end of a rollout, so the tail is enough
// even for multi-megabyte files.
const CODEX_TAIL_BYTES = 512 * 1024

const clampPercent = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.min(100, Math.max(0, value))
}

const parseWhen = (value: unknown): number | undefined => {
  if (typeof value !== 'string') return undefined
  const ts = Date.parse(value)
  return Number.isFinite(ts) ? ts : undefined
}

// ---------------------------------------------------------------------------
// Claude: the same OAuth usage endpoint Claude Code's /usage screen reads.
// ---------------------------------------------------------------------------

interface ClaudeCreds {
  accessToken?: string
  expiresAt?: number
  subscriptionType?: string
}

async function claudeCredentials(): Promise<ClaudeCreds | null> {
  const file = path.join(os.homedir(), '.claude', '.credentials.json')
  try {
    const parsed = JSON.parse(await fs.promises.readFile(file, 'utf8'))
    if (parsed?.claudeAiOauth) return parsed.claudeAiOauth as ClaudeCreds
  } catch {}
  if (process.platform !== 'darwin') return null
  // On macOS Claude Code keeps its OAuth credentials in the Keychain.
  return new Promise(resolve => {
    execFile(
      'security',
      ['find-generic-password', '-s', 'Claude Code-credentials', '-w'],
      { timeout: 5000 },
      (err, stdout) => {
        if (err) return resolve(null)
        try {
          resolve((JSON.parse(stdout.trim())?.claudeAiOauth as ClaudeCreds) ?? null)
        } catch {
          resolve(null)
        }
      }
    )
  })
}

function claudeAccount(): { accountId?: string; accountLabel?: string } {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude.json'), 'utf8'))
    const account = parsed?.oauthAccount
    if (!account) return {}
    return {
      accountId: typeof account.accountUuid === 'string' ? account.accountUuid : undefined,
      accountLabel: typeof account.emailAddress === 'string' ? account.emailAddress : undefined
    }
  } catch {
    return {}
  }
}

const CLAUDE_KIND_LABELS: Record<string, string> = {
  session: '5-hour limit',
  weekly_all: 'Weekly (all models)'
}

function claudeWindowFromLimit(limit: any): UsageWindow | null {
  if (typeof limit?.kind !== 'string') return null
  const percent = clampPercent(limit.percent)
  if (percent === null) return null
  const model = limit.scope?.model?.display_name
  const label =
    limit.kind === 'weekly_scoped' && typeof model === 'string'
      ? `Weekly (${model})`
      : (CLAUDE_KIND_LABELS[limit.kind] ?? limit.kind.replace(/_/g, ' '))
  return {
    key: limit.kind + (typeof model === 'string' ? `:${model}` : ''),
    label,
    percent,
    severity: typeof limit.severity === 'string' ? limit.severity : undefined,
    resetsAt: parseWhen(limit.resets_at),
    active: limit.is_active === true
  }
}

// The endpoint also exposes flat five_hour/seven_day objects; older accounts
// may only have those, so they are the fallback when `limits` is missing.
const CLAUDE_FLAT_LABELS: Record<string, string> = {
  five_hour: '5-hour limit',
  seven_day: 'Weekly (all models)',
  seven_day_opus: 'Weekly (Opus)',
  seven_day_sonnet: 'Weekly (Sonnet)'
}

export async function claudeUsage(): Promise<AgentUsage | null> {
  const base: AgentUsage = { provider: 'claude', fetchedAt: Date.now(), windows: [], ...claudeAccount() }
  const creds = await claudeCredentials()
  if (!creds?.accessToken) {
    return { ...base, error: 'Not signed in to Claude Code on this machine.' }
  }
  base.plan = typeof creds.subscriptionType === 'string' ? creds.subscriptionType : undefined
  if (typeof creds.expiresAt === 'number' && creds.expiresAt < Date.now()) {
    return { ...base, error: 'Claude sign-in expired — run claude once to refresh it.' }
  }
  let body: any
  try {
    const res = await fetch('https://api.anthropic.com/api/oauth/usage', {
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        'anthropic-beta': 'oauth-2025-04-20',
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    })
    if (!res.ok) {
      return { ...base, error: `Could not read usage from Anthropic (HTTP ${res.status}).` }
    }
    body = await res.json()
  } catch {
    return { ...base, error: 'Could not reach Anthropic to read usage.' }
  }
  const windows: UsageWindow[] = []
  if (Array.isArray(body?.limits)) {
    for (const limit of body.limits) {
      const window = claudeWindowFromLimit(limit)
      if (window) windows.push(window)
    }
  }
  if (windows.length === 0) {
    for (const [key, label] of Object.entries(CLAUDE_FLAT_LABELS)) {
      const entry = body?.[key]
      const percent = clampPercent(entry?.utilization)
      if (percent === null) continue
      windows.push({ key, label, percent, resetsAt: parseWhen(entry?.resets_at) })
    }
  }
  if (windows.length === 0) {
    return { ...base, error: 'Anthropic returned no usage limits for this account.' }
  }
  return { ...base, windows }
}

// ---------------------------------------------------------------------------
// Codex: the CLI records rate-limit snapshots in its session rollout files.
// ---------------------------------------------------------------------------

function codexAccount(): { accountId?: string; accountLabel?: string; plan?: string } {
  try {
    const auth = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.codex', 'auth.json'), 'utf8'))
    const out: { accountId?: string; accountLabel?: string; plan?: string } = {}
    if (typeof auth?.tokens?.account_id === 'string') out.accountId = auth.tokens.account_id
    const idToken = auth?.tokens?.id_token
    if (typeof idToken === 'string') {
      const payload = idToken.split('.')[1]
      if (payload) {
        const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
        if (typeof claims?.email === 'string') out.accountLabel = claims.email
        const plan = claims?.['https://api.openai.com/auth']?.chatgpt_plan_type
        if (typeof plan === 'string') out.plan = plan
      }
    }
    return out
  } catch {
    return {}
  }
}

function codexSessionFiles(dir: string): string[] {
  const found: Array<{ file: string; mtime: number }> = []
  const walk = (at: string) => {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(at, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(at, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.jsonl')) {
        try {
          found.push({ file: full, mtime: fs.statSync(full).mtimeMs })
        } catch {}
      }
    }
  }
  walk(dir)
  return found.sort((a, b) => b.mtime - a.mtime).map(f => f.file)
}

function readTail(file: string): string {
  const fd = fs.openSync(file, 'r')
  try {
    const size = fs.fstatSync(fd).size
    const length = Math.min(size, CODEX_TAIL_BYTES)
    const buffer = Buffer.alloc(length)
    fs.readSync(fd, buffer, 0, length, size - length)
    return buffer.toString('utf8')
  } finally {
    fs.closeSync(fd)
  }
}

function codexWindowLabel(minutes: unknown, fallback: string): string {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) return fallback
  const days = minutes / 1440
  if (days >= 6.5 && days <= 8) return 'Weekly limit'
  if (days >= 0.9 && days <= 1.5) return 'Daily limit'
  const hours = Math.round(minutes / 60)
  return hours >= 1 ? `${hours}-hour limit` : `${Math.round(minutes)}-minute limit`
}

function codexWindows(rateLimits: any, recordedAt: number): UsageWindow[] {
  const windows: UsageWindow[] = []
  for (const key of ['primary', 'secondary']) {
    const entry = rateLimits?.[key]
    const percent = clampPercent(entry?.used_percent)
    if (percent === null) continue
    let resetsAt = parseWhen(entry?.resets_at)
    if (resetsAt === undefined && typeof entry?.resets_in_seconds === 'number') {
      resetsAt = recordedAt + entry.resets_in_seconds * 1000
    }
    windows.push({
      key,
      label: codexWindowLabel(entry?.window_minutes, key === 'primary' ? '5-hour limit' : 'Weekly limit'),
      percent,
      resetsAt
    })
  }
  return windows
}

export async function codexUsage(): Promise<AgentUsage | null> {
  const base: AgentUsage = { provider: 'codex', fetchedAt: Date.now(), windows: [], ...codexAccount() }
  const sessionsDir = path.join(os.homedir(), '.codex', 'sessions')
  const files = codexSessionFiles(sessionsDir).slice(0, CODEX_FILE_LIMIT)
  for (const file of files) {
    let tail: string
    try {
      tail = readTail(file)
    } catch {
      continue
    }
    const lines = tail.split('\n')
    for (let i = lines.length - 1; i >= 0; i--) {
      if (!lines[i].includes('rate_limits')) continue
      let parsed: any
      try {
        parsed = JSON.parse(lines[i])
      } catch {
        continue
      }
      const rateLimits = parsed?.payload?.rate_limits ?? parsed?.rate_limits
      if (!rateLimits) continue
      const recordedAt = parseWhen(parsed?.timestamp) ?? fs.statSync(file).mtimeMs
      const windows = codexWindows(rateLimits, recordedAt)
      if (windows.length === 0) continue
      return { ...base, asOf: recordedAt, windows }
    }
  }
  return { ...base, error: 'No usage recorded yet — appears after this Codex runs once.' }
}
