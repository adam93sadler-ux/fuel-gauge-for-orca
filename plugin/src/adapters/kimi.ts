import { api, login, record, rows, string, window, type Query } from './shared'

// Experimental reader for the Kimi CLI managed OAuth credential store.
export default async function detect(): Promise<Query | undefined> {
  const token = string((await login('.kimi/credentials/kimi-code.json'))?.access_token)
  if (!token) return
  return async () => {
    const data = await api('https://api.kimi.com/coding/v1/usages', token)
    const limits = rows(data.limits).map(item => record(item.detail ?? item))
    return { windows: [record(data.usage), ...limits].flatMap((row, index) => {
      const limit = Number(row.limit)
      const used = row.used != null ? Number(row.used) : limit - Number(row.remaining ?? NaN)
      if (!(limit > 0)) return []
      return window(string(row.name ?? row.title) ?? (index ? 'quota ' + index : 'week'),
        used * 100 / limit, row.reset_at ?? row.resetAt ?? row.reset_time ?? row.resetTime)
    }) }
  }
}
