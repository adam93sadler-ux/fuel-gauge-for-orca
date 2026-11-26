# Orca agent providers

Orca 1.4.271's bundled agent launch registry supplies the IDs and primary executable names below. Orca resolves aliases and platform conditions itself. Fuel Gauge checks `orca agent installed --json` once per refresh. The managed account list covers a subset of the picker. Installation-only entries establish CLI availability. Their account status and remaining allowance require owner confirmation.

| Orca ID | Primary executable | Billing | Reading | Confidence | Typical user config or login |
|---|---|---|---|---|---|
| `claude` | `claude` | Subscription or API | ✓ OAuth windows | tested | `~/.claude/.credentials.json` |
| `claude-agent-teams` | `orca` | Shared Claude account | ✓ Shared Claude windows | experimental | `~/.claude/.credentials.json` |
| `codebuddy` | `codebuddy` | Free or subscription credits | — Installation only | experimental | `~/.codebuddy/` |
| `openclaude` | `openclaude` | Selected model backend | — Installation only | experimental | `~/.openclaude/settings.json` |
| `codex` | `codex` | ChatGPT plan or API | ✓ ChatGPT windows | tested | `~/.codex/auth.json` |
| `autohand` | `autohand` | Plan credits | — Installation only | experimental | `~/.autohand/` |
| `ante` | `ante` | Local inference or selected backend | — Installation only | experimental | `~/.ante/settings.json` |
| `trae` | `traecli` | Free access or selected backend | — Installation only | experimental | Unverified |
| `opencode` | `opencode` | Selected backend (hosted or local) | — Installation only | experimental | `~/.local/share/opencode/auth.json` |
| `opencode2` | `opencode2` | Selected backend (hosted or local) | — Installation only | experimental | Unverified |
| `mimo-code` | `mimo` | Token plan or API | — Installation only | experimental | `~/.local/share/mimocode/` |
| `pi` | `pi` | Selected backend (hosted or local) | — Installation only | experimental | `~/.pi/agent/auth.json` |
| `omp` | `omp` | Selected backend (hosted or local) | — Installation only | experimental | `~/.omp/agent/config.yml` |
| `prime-agent` | `prime-agent` | Inference API or selected backend | — Installation only | experimental | `~/.prime/agent/` |
| `qoder` | `qodercli` | Plan or credits | — Installation only | experimental | `~/.qoder/settings.json` |
| `qoder-cn` | `qoderclicn` | Plan or credits | — Installation only | experimental | Unverified |
| `gemini` | `gemini` | Google plan or API | ~ Google OAuth quota buckets | experimental | `~/.gemini/oauth_creds.json` |
| `antigravity` | `agy` | Google plan | ✓ Model pools | tested | `~/.gemini/antigravity-cli/` |
| `aider` | `aider` | Selected backend (hosted or local) | — Installation only | experimental | `~/.aider.conf.yml` |
| `goose` | `goose` | Selected backend (hosted or local) | — Installation only | experimental | `~/.config/goose/config.yaml` |
| `amp` | `amp` | Plan or credits | ~ Free allowance and individual credit balance | experimental | `~/.config/amp/settings.json` |
| `kilo` | `kilo` | Selected backend (hosted or local) | — Installation only | experimental | `~/.config/kilo/kilo.json` |
| `kiro` | `kiro-cli` | Plan or credits | — Installation only | experimental | `~/.kiro/settings/cli.json` |
| `crush` | `crush` | Selected backend (hosted or local) | — Installation only | experimental | `~/.config/crush/` |
| `aug` | `auggie` | Plan or credits | — Installation only | experimental | `~/.augment/settings.json` |
| `cline` | `cline` | Selected backend (hosted or local) | — Installation only | experimental | `~/.cline/` |
| `freebuff` | `freebuff` | Free tier | — Installation only | experimental | `~/.config/freebuff/` |
| `codebuff` | `codebuff` | Plan or credits | — Installation only | experimental | `~/.config/manicode/codebuff/` |
| `command-code` | `command-code` | Monthly model credits | — Installation only | experimental | `~/.commandcode/` |
| `continue` | `cn` | Selected backend (hosted or local) | — Installation only | experimental | `~/.continue/config.yaml` |
| `cursor` | `cursor-agent` | Plan or credits | ~ File-backed CLI monthly usage | experimental | `~/.config/cursor/auth.json` |
| `droid` | `droid` | Plan or credits | — Installation only | experimental | `~/.factory/settings.json` |
| `kimi` | `kimi` | Plan or credits | ~ Managed OAuth quota | experimental | `~/.kimi/credentials/kimi-code.json` |
| `mistral-vibe` | `vibe` | Plan or API | — Installation only | experimental | `~/.vibe/config.toml` |
| `qwen-code` | `qwen` | Selected model backend | — Installation only | experimental | `~/.qwen/settings.json` |
| `rovo` | `acli` | Plan or credits | — Installation only | experimental | `~/.rovodev/config.yml` |
| `hermes` | `hermes` | Selected backend (hosted or local) | ~ Default-profile Codex | experimental | `~/.hermes/config.yaml` |
| `openclaw` | `openclaw` | Selected backend (hosted or local) | — Installation only | experimental | `~/.openclaw/openclaw.json` |
| `copilot` | `copilot` | Plan or credits | — Installation only | experimental | `~/.copilot/config.json` |
| `grok` | `grok` | Grok plan or API | — Installation only | experimental | `~/.grok/config.toml` |
| `muse` | `muse` | API token usage | — Installation only | experimental | `~/.config/muse/settings.json` |
| `dsh` | `dsh-tui` | API balance | ✓ DeepSeek balance | tested | `~/.config/deepseek/api_key` |
| `zcode` | `zcode` | Coding plan or API | ~ Legacy Coding Plan quota | experimental | `~/.zcode/cli/config.json` |
| `devin` | `devin` | Plan or credits | — Installation only | experimental | `~/.local/share/devin/credentials.toml` |
| `jcode` | `jcode` | Subscription or selected backend | — Installation only | experimental | `~/.config/jcode/` |

Claude and Teams share `~/.claude/.credentials.json` and the Anthropic OAuth usage endpoint. Codex reads ChatGPT window data with `~/.codex/auth.json`. Antigravity checks its keyring or native login under `~/.gemini` and calls the version-gated native `/usage` command. The DeepSeek Harness snapshot key remains `deepseek`; the adapter uses `~/.config/deepseek/api_key`. [DeepSeek balance API](https://api-docs.deepseek.com/api/get-user-balance/)

Gemini CLI uses `~/.gemini/oauth_creds.json` and Google's Code Assist loadCodeAssist and retrieveUserQuota RPCs. API-key and Vertex accounts require a separate billing source. [Gemini CLI commands](https://geminicli.com/docs/reference/commands/)

Hermes selects a backend in `~/.hermes/config.yaml`. Its `hermes usage --json` command can report account limits for some hosted backends. Custom endpoints and provider plugins can control destination URLs, so the adapter queries only the pinned official host for a default-profile Codex account without a credential pool. [Hermes CLI](https://hermes-agent.nousresearch.com/docs/reference/cli-commands/)

Kimi CLI uses `~/.kimi/config.toml` and a managed OAuth credential in `~/.kimi/credentials/kimi-code.json`. Its interactive `/usage` command reads weekly and scoped limits. Newer Kimi Code versions also support a separate configuration directory. [Kimi usage implementation](https://github.com/MoonshotAI/kimi-cli/blob/main/src/kimi_cli/ui/shell/usage.py)

Qoder exposes billing-cycle credits in the interactive `/usage` panel. [Qoder usage](https://docs.qoder.com/cli/usage)

## Additional provider references

- CodeBuddy CLI Tencent. [Documentation](https://www.codebuddy.ai/docs/cli/cli-reference)
- openclaude CLI. [Documentation](https://github.com/Gitlawb/openclaude)
- Autohand CLI. [Documentation](https://docs.autohand.ai/console/usage-and-billing)
- Ante CLI coding agent. [Documentation](https://docs.antigma.ai/)
- Trae CLI. [Documentation](https://docs.trae.cn/cli_global-settings)
- OpenCode CLI. [Documentation](https://opencode.ai/docs/cli/)
- MiMo Code CLI. [Documentation](https://mimo.mi.com/docs/en-US/integration/mimo-code)
- Prime Intellect prime-agent CLI. [Documentation](https://github.com/PrimeIntellect-ai/prime-agent)
- Qoder CLI. [Documentation](https://docs.qoder.com/cli/usage)
- Aider CLI. [Documentation](https://aider.chat/docs/config)
- Goose Block CLI. [Documentation](https://block.github.io/goose/docs/guides/config-files/)
- Kilo CLI. [Documentation](https://kilo.ai/docs/code-with-ai/platforms/cli)
- Kiro CLI. [Documentation](https://kiro.dev/docs/cli/authentication/)
- Crush Charm CLI. [Documentation](https://github.com/charmbracelet/crush)
- Augment Auggie CLI. [Documentation](https://github.com/augmentcode/auggie/blob/main/README.md)
- Cline CLI. [Documentation](https://github.com/cline/cline/blob/main/docs/getting-started/authorizing-with-cline.mdx)
- Freebuff CLI. [Documentation](https://github.com/CodebuffAI/freebuff)
- Codebuff CLI. [Documentation](https://www.codebuff.com/docs/help/quick-start)
- Command Code CLI. [Documentation](https://commandcode.ai/docs/settings)
- Continue cn CLI. [Documentation](https://docs.continue.dev/cli/configuration)
- Cursor agent CLI. [Documentation](https://prod.cursor.com/docs/cli/reference/configuration)
- Factory Droid CLI. [Documentation](https://docs.factory.com/droid-cli/cli-reference)
- Mistral Vibe CLI. [Documentation](https://docs.mistral.ai/getting-started/quickstarts/vibe-code/install-cli)
- Qwen Code CLI. [Documentation](https://github.com/QwenLM/qwen-code/blob/main/docs/users/configuration/auth.md)
- Atlassian Rovo Dev CLI. [Documentation](https://support.atlassian.com/rovo/docs/manage-rovo-dev-cli-settings)
- OpenClaw CLI. [Documentation](https://docs.openclaw.ai/cli)
- GitHub Copilot CLI. [Documentation](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli?plain=1)
- xAI Grok CLI. [Documentation](https://docs.x.ai/grok/faq)
- Zcode coding agent CLI. [Documentation](https://zcode.z.ai/en/docs/configuration)
- Devin CLI. [Documentation](https://docs.devin.ai)
- jcode coding agent CLI. [Documentation](https://jcode.sh/docs)
- Amp CLI. [Documentation](https://ampcode.com/docs/cli)
- Kimi Code CLI. [Documentation](https://www.kimi.com/code/docs/en/kimi-code-cli/configuration/config-files)

Cursor reads the current billing period from its own dashboard API using the CLI file login. Orca also supports account-specific sources for OpenCode Go and Zen, v2 ZCode accounts, and Muse local token totals. Their readings can be supplied manually. [Orca usage tracking](https://orca.dev/docs/agents/usage-tracking)

- Pi. [Provider documentation](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent)
- Oh My Pi. [Settings](https://github.com/can1357/oh-my-pi/blob/main/docs/settings.md)

Amp's native `amp usage` prints free and paid credits. The adapter runs the query with isolated settings pinned to ampcode.com. [Amp pricing](https://ampcode.com/docs/pricing)

ZCode reads the selected legacy CLI model and uses its official Coding Plan host. The v2 credential store and Orca-managed plan keys are outside this reader's scope. Kiro also provides an interactive `/usage` panel with account credits. [ZCode configuration](https://zcode.z.ai/en/docs/configuration) · [Kiro terminal UI](https://kiro.dev/docs/cli/terminal-ui/)

Billing references include [CodeBuddy plans](https://www.codebuddy.ai/docs/ide/Account/pricing), [Ante local inference](https://docs.antigma.ai/), [TRAE CLI](https://www.trae.ai/cli), [Command Code plan allowances](https://commandcode.ai/docs/plans/pro), [Grok plans](https://x.ai/pricing), and [Jcode billing](https://jcode.sh/terms).
