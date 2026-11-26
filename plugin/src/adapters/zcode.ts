import { login, record, rows, string, window, ReadingError, type Query } from './shared'

// Experimental legacy CLI reader. Prefer the current account when v2 is present.
export default async function detect(): Promise<Query | undefined> {
  if (await login('.zcode/v2/provider_config.json')) return
  const config = await login('.zcode/cli/config.json')
  const model = string(config?.model) ?? string(record(config?.model).main)
  if (!model?.includes('/')) return
  const selected = record(record(config?.provider)[model.split('/')[0]])
  const options = record(selected.options)
  const key = string(options.apiKey)
  if (!key || typeof options.baseURL !== 'string') return
  const origin = new URL(options.baseURL).origin
  if (!['https://api.z.ai', 'https://open.bigmodel.cn', 'https://dev.bigmodel.cn'].includes(origin)) return
  return async () => {
    const reply = await fetch(origin + '/api/monitor/usage/quota/limit', {
      headers: { Authorization: key }, redirect: 'error', signal: AbortSignal.timeout(12000)
    })
    if (!reply.ok) throw new ReadingError('ZCode quota request returned HTTP ' + reply.status)
    const data = record(await reply.json())
    return { windows: rows(record(data.data).limits).flatMap(limit => {
      const total = limit.usage
      const used = typeof limit.currentValue === 'number' ? limit.currentValue :
        typeof total === 'number' && typeof limit.remaining === 'number' ? total - limit.remaining : undefined
      const percent = typeof total === 'number' && total > 0 && used !== undefined ? used * 100 / total : limit.percentage
      return window(string(limit.type) ?? 'Coding Plan', percent,
        typeof limit.nextResetTime === 'number' ? limit.nextResetTime / 1000 : undefined)
    }) }
  }
}
