import { join } from 'node:path'
import { login, record, string, rows, window, run, home, ReadingError, type Query, type RecordValue } from './shared'

let unsupportedAgy = false

export default async function detect(): Promise<Query | undefined> {
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
