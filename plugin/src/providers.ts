import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const home = homedir()
export type Window = { name: string; usedPercent: number; resetsAt: string | null; minutes?: number }
export type Usage = { windows: Window[]; balances?: { currency: string; total: number }[] }
type Query = () => Promise<Usage>
type RecordValue = Record<string, unknown>

function record(value: unknown): RecordValue {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}
}

function rows(value: unknown): RecordValue[] {
  return Array.isArray(value) ? value.map(record) : []
}

function string(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

async function localFile(path: string): Promise<string | undefined> {
  try {
    return await readFile(join(home, path), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw new ReadingError('local login could not be read')
  }
}

function decode(value: string): unknown {
  try { return JSON.parse(value) } catch { throw new ReadingError('unrecognized data format') }
}

async function login(path: string): Promise<RecordValue | undefined> {
  const text = await localFile(path)
  return text === undefined ? undefined : record(decode(text))
}

export class ReadingError extends Error {}

async function api(url: string, token: string, headers: Record<string, string> = {}) {
  const signal = AbortSignal.timeout(12_000)
  try {
    const response = await fetch(url, {
      redirect: 'error', signal,
      headers: { ...headers, Authorization: `Bearer ${token}`, Accept: 'application/json' }
    })
    if (!response.ok) {
      await response.body?.cancel()
      throw new ReadingError(
        response.status === 401 || response.status === 403 ? 'login rejected'
          : response.status === 429 ? 'usage endpoint is rate limiting requests'
          : `usage endpoint returned HTTP ${response.status}`
      )
    }
    return record(decode(await response.text()))
  } catch (error) {
    if (error instanceof ReadingError) throw error
    throw new ReadingError(signal.aborted ? 'usage request timed out' : 'usage endpoint unavailable')
  }
}

function window(name: string, percent: unknown, reset: unknown, minutes?: number): Window[] {
  if (typeof percent !== 'number' || !Number.isFinite(percent)) return []
  const date = typeof reset === 'number' ? new Date(reset * 1000) : new Date(string(reset) ?? '')
  return [{
    name, usedPercent: Math.min(100, Math.max(0, percent)),
    resetsAt: date.getTime() > 0 ? date.toISOString() : null,
    ...(minutes ? { minutes } : {})
  }]
}

async function claude(): Promise<Query | undefined> {
  const auth = record((await login('.claude/.credentials.json'))?.claudeAiOauth)
  const token = string(auth.accessToken)
  if (!token) return
  return async () => {
    const data = await api('https://api.anthropic.com/api/oauth/usage', token, {
      'anthropic-beta': 'oauth-2025-04-20', 'User-Agent': 'claude-code/2.1.0'
    })
    const short = record(data.five_hour)
    const week = record(data.seven_day)
    const scoped = rows(data.limits).find((limit) =>
      limit.kind === 'weekly_scoped' && record(record(limit.scope).model).display_name === 'Fable'
    )
    const fable = scoped ?? record(data.fable_weekly ?? data.fable_seven_day ?? data.seven_day_fable)
    return { windows: [
      ...window('5h', short.utilization ?? short.used_percentage, short.resets_at, 300),
      ...window('week', week.utilization ?? week.used_percentage, week.resets_at, 10080),
      ...window('Fable week', fable.percent ?? fable.utilization ?? fable.used_percentage, fable.resets_at, 10080)
    ] }
  }
}

async function codex(): Promise<Query | undefined> {
  const auth = await login('.codex/auth.json')
  if (!auth) return
  const tokens = record(auth.tokens)
  const token = string(tokens.access_token)
  if (!token && !string(auth.OPENAI_API_KEY)) return
  return async () => {
    if (!token) throw new ReadingError('subscription usage requires a ChatGPT login')
    const accountId = string(tokens.account_id)
    const data = await api('https://chatgpt.com/backend-api/wham/usage', token, {
      ...(accountId ? { 'ChatGPT-Account-Id': accountId } : {}), originator: 'Codex Desktop'
    })
    const limit = record(data.rate_limit)
    const windows = ['primary_window', 'secondary_window'].flatMap((name) => {
      const value = record(limit[name])
      const seconds = value.limit_window_seconds
      const minutes = typeof seconds === 'number' && seconds > 0 ? Math.ceil(seconds / 60) : undefined
      const label = minutes === 10080 ? 'week' : minutes && minutes % 60 === 0 ? `${minutes / 60}h` : minutes ? `${minutes}m` : name
      return window(label, value.used_percent, value.reset_at, minutes)
    })
    const monthly = record(record(data.spend_control).individual_limit)
    if (!windows.length && typeof monthly.remaining_percent === 'number') {
      windows.push(...window('month', 100 - monthly.remaining_percent, monthly.reset_at))
    }
    return { windows }
  }
}

let unsupportedAgy = false

async function antigravity(): Promise<Query | undefined> {
  const modern = await login('.gemini/antigravity-cli/antigravity-oauth-token')
  const legacy = await login('.gemini/jetski-standalone-oauth-token')
  const token = (auth: RecordValue | undefined) => string(record(auth?.token ?? auth).access_token)
  const unlocked = process.platform === 'linux' && await run('gdbus', [
    'call', '--session', '--timeout', '3', '--dest', 'org.freedesktop.secrets',
    '--object-path', '/org/freedesktop/secrets',
    '--method', 'org.freedesktop.Secret.Service.SearchItems',
    "{'service': 'gemini', 'username': 'antigravity'}"
  ], { timeout: 4_000, maxBuffer: 4096 }).then(
    ({ stdout }) => /^\(\[objectpath /.test(stdout), () => false
  )
  if (!token(modern) && !unlocked && !token(legacy)) return
  return async () => {
    if (!unlocked && !token(modern)) throw new ReadingError('native agy login unavailable; check the local keyring')
    if (unsupportedAgy) throw new ReadingError('update agy to a version with read-only /usage')
    const options = {
      env: { ...process.env, AGY_CLI_DISABLE_AUTO_UPDATE: 'true' },
      maxBuffer: 512 * 1024,
      timeout: 5_000
    }
    const binary = join(home, '.local/bin/agy')
    let version
    let program = binary
    try {
      version = (await run(program, ['--version'], options)).stdout
    } catch {
      program = 'agy'
      try { version = (await run(program, ['--version'], options)).stdout }
      catch { throw new ReadingError('agy version could not be read') }
    }
    const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)$/)
    if (!match || Number(match[1]) < 1 ||
      (Number(match[1]) === 1 && (Number(match[2]) < 1 ||
        (Number(match[2]) === 1 && Number(match[3]) < 11)))) {
      throw new ReadingError('update agy to 1.1.11 or newer')
    }
    // Orca uses this version-gated print command to read the native QuotaSummary.
    let stdout
    try {
      stdout = (await run(program, ['-p', '/usage', '--output-format', 'json', '--print-timeout', '15s'],
        { ...options, timeout: 20_000 })).stdout
    } catch {
      throw new ReadingError('agy quota unavailable; check Antigravity sign-in')
    }
    for (const line of stdout.split('\n')) {
      if (!line.trimStart().startsWith('{')) continue
      let envelope
      try { envelope = record(JSON.parse(line)) } catch { continue }
      const command = record(envelope.command)
      if (envelope.status === 'SUCCESS' && command.name === 'usage') {
        return { windows: rows(record(command.data).groups).flatMap((group) =>
          rows(group.buckets).flatMap((bucket) => {
            const fraction = bucket.remaining_fraction
            if (bucket.disabled === true || typeof fraction !== 'number') return []
            const label = string(bucket.window) ?? 'quota'
            return window(`${string(group.name) ?? 'Pool'} ${label}`, (1 - fraction) * 100,
              bucket.reset_time, label === '5h' ? 300 : label === 'weekly' ? 10080 : undefined)
          })
        ) }
      }
      if (envelope.conversation_id || Number(envelope.num_turns) > 0) unsupportedAgy = true
    }
    throw new ReadingError('agy returned no quota; check Antigravity sign-in')
  }
}

async function deepseek(): Promise<Query | undefined> {
  const key = string(await localFile('.config/deepseek/api_key'))
  if (!key) return
  return async () => {
    const data = await api('https://api.deepseek.com/user/balance', key)
    const balances = rows(data.balance_infos).flatMap((info) => {
      const currency = string(info.currency)
      const total = string(info.total_balance) ?? info.total_balance
      return currency && /^[A-Z]{3}$/.test(currency) && (typeof total === 'number' || typeof total === 'string')
        && Number.isFinite(Number(total)) ? [{ currency, total: Number(total) }] : []
    })
    return { windows: [], balances }
  }
}

export const providers = { claude, codex, antigravity, deepseek }
