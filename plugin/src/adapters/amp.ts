import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { home, run, window, type Query, type Usage } from './shared'

// Experimental. Caller checks Orca's installation inventory before detection.
export default async function detect(): Promise<Query> {
  return async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'fuel-gauge-amp-'))
    try {
      const settings = join(cwd, 'settings.json')
      await writeFile(settings, JSON.stringify({ 'amp.url': 'https://ampcode.com' }))
      const { stdout } = await run('amp', ['usage', '--no-color', '--settings-file', settings], {
        cwd, timeout: 12000, maxBuffer: 65536,
        env: { HOME: home, PATH: process.env.PATH, AMP_SKIP_UPDATE_CHECK: '1', AMP_URL: 'https://ampcode.com' }
      })
      const usage: Usage = { windows: [], balances: [] }
      for (const line of stdout.split('\n')) {
        const free = /^Amp Free:\s*\$([\d.]+)\s*\/\s*\$([\d.]+) remaining/i.exec(line)
        if (free && Number(free[2]) > 0) usage.windows.push(...window('Free credits', 100 * (1 - Number(free[1]) / Number(free[2])), null))
        const paid = /^Individual credits:\s*\$([\d.]+) remaining/i.exec(line)
        if (paid && Number.isFinite(Number(paid[1]))) usage.balances!.push({ currency: 'USD', total: Number(paid[1]) })
      }
      return usage
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  }
}
