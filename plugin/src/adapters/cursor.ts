import { login, record, string, window, ReadingError, type Query } from './shared'

// Experimental. Supports file-backed Cursor CLI credentials on Linux and macOS.
export default async function detect(): Promise<Query | undefined> {
  const path = process.platform === 'darwin' ? '.cursor/auth.json' : '.config/cursor/auth.json'
  const token = string((await login(path))?.accessToken)
  if (!token) return
  return async () => {
    const payload = record(JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()))
    const subject = string(payload.sub)
    if (!subject || !/^[A-Za-z0-9._-]+$/.test(token)) throw new ReadingError('unrecognized Cursor sign-in')
    const response = await fetch('https://cursor.com/api/dashboard/get-current-period-usage', {
      method: 'POST', body: '{}', redirect: 'error', signal: AbortSignal.timeout(12000),
      headers: { 'Content-Type': 'application/json', Cookie: 'WorkosCursorSessionToken=' + encodeURIComponent(subject) + '%3A%3A' + token }
    })
    if (!response.ok) throw new ReadingError('Cursor quota request returned HTTP ' + response.status)
    const data = record(await response.json())
    const plan = record(data.planUsage)
    return { windows: [
      ...window('billing period', plan.totalPercentUsed, data.billingCycleEnd),
      ...window('Auto', plan.autoPercentUsed, data.billingCycleEnd),
      ...window('API', plan.apiPercentUsed, data.billingCycleEnd)
    ] }
  }
}
