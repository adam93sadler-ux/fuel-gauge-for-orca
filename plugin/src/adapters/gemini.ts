import { login, record, rows, string, window, ReadingError, type Query } from './shared'

// Experimental. Both POST RPCs retrieve account metadata without running a model.
export default async function detect(): Promise<Query | undefined> {
  const token = string((await login('.gemini/oauth_creds.json'))?.access_token)
  if (!token) return
  async function query(method: string, body: object) {
    const response = await fetch('https://cloudcode-pa.googleapis.com/v1internal:' + method, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(12000),
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!response.ok) throw new ReadingError('Gemini quota request returned HTTP ' + response.status)
    return record(await response.json())
  }
  return async () => {
    const account = await query('loadCodeAssist', {
      cloudaicompanionProject: process.env.GOOGLE_CLOUD_PROJECT,
      metadata: { ideType: 'IDE_UNSPECIFIED', platform: 'PLATFORM_UNSPECIFIED', pluginType: 'GEMINI' }
    })
    const project = string(account.cloudaicompanionProject) ?? process.env.GOOGLE_CLOUD_PROJECT
    if (!project) throw new ReadingError('Gemini account project unavailable')
    const quota = await query('retrieveUserQuota', { project })
    return { windows: rows(quota.buckets).flatMap(bucket =>
      typeof bucket.remainingFraction === 'number'
        ? window(string(bucket.modelId) ?? 'quota', 100 * (1 - bucket.remainingFraction), bucket.resetTime)
        : []) }
  }
}
