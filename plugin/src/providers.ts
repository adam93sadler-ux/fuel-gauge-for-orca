import { join } from 'node:path'
import { homedir } from 'node:os'
import amp from './adapters/amp'
import zcode from './adapters/zcode'
import cursor from './adapters/cursor'
import hermes from './adapters/hermes'
import kimi from './adapters/kimi'
import claude from './adapters/claude'
import codex from './adapters/codex'
import antigravity from './adapters/antigravity'
import deepseek from './adapters/deepseek'
import gemini from './adapters/gemini'
import { run, ReadingError, type Query } from './adapters/shared'
export { ReadingError, type Usage } from './adapters/shared'

type Adapter = { detect(): Promise<Query | undefined> }
const readers: Record<string, Adapter['detect']> = { amp, zcode, cursor, hermes, kimi, claude, codex, antigravity, deepseek, gemini, 'claude-agent-teams': claude }

// Experimental detection-only adapters use the same installation inventory as the tab picker.
export async function inventory(): Promise<Set<string>> {
  try {
    const { stdout } = await run(process.env.ORCA_CLI_COMMAND || (process.platform === 'linux' ? join(homedir(), '.config/orca/linux-orca-cli-shim/orca') : 'orca'), ['agent', 'installed', '--json'], { timeout: 8000 })
    return new Set(JSON.parse(stdout).result.agents.map((agent: { id: string }) => agent.id))
  } catch { return new Set() }
}

export function adapters(installed: Set<string>): Record<string, Adapter> {
  const ids = new Set([...Object.keys(readers), ...Array.from(installed, agent => agent === 'dsh' ? 'deepseek' : agent)])
  return Object.fromEntries(Array.from(ids, id => [id, {
    async detect() {
      if ((id === 'amp' || id === 'claude-agent-teams') && !installed.has(id)) return
      const read = await readers[id]?.()
      if (read) return read
      if (installed.has(id === 'deepseek' ? 'dsh' : id)) return async () => { throw new ReadingError('no usage data available from this provider') }
    }
  }]))
}
