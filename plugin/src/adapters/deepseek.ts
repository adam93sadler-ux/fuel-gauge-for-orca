import { string, api, rows, localFile, type Query } from './shared'

export default async function detect(): Promise<Query | undefined> {
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
