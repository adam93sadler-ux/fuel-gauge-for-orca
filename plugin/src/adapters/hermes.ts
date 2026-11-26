import { readCodexAccount } from './codex'
import { localFile, login, record, type Query } from './shared'

// Experimental support for an unambiguous default-profile Codex account.
// Hermes plugins can select arbitrary base URLs. Reuse the pinned ChatGPT reader.
export default async function detect(): Promise<Query | undefined> {
  const config = await localFile('.hermes/config.yaml')
  const model = config?.match(/^model:[ \t]*\r?\n((?:[ \t]+[^\n]*\n?)+)/m)?.[1]
  if (!model || !/^  provider: ['"]?openai-codex['"]?\s*$/m.test(model)) return
  const auth = await login('.hermes/auth.json')
  if (!auth || record(auth.credential_pool)['openai-codex']) return
  return readCodexAccount(record(record(auth.providers)['openai-codex']))
}
