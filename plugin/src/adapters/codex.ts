import { login, record, string, api, window, ReadingError, type RecordValue, type Query } from './shared'

export default async function detect(): Promise<Query | undefined> {
  return readCodexAccount(await login('.codex/auth.json'))
}

export function readCodexAccount(auth: RecordValue | undefined): Query | undefined {
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
