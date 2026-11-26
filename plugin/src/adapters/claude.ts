import { login, record, string, api, rows, window, type Query } from './shared'

export default async function detect(): Promise<Query | undefined> {
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
