---
name: fuel-gauge
description: Track how much usage is left on each AI provider (Claude, Codex, Antigravity…) while orchestrating agents, and route the next job to the same tier of model on whichever provider has the most room. Use when handing work to an agent, every 30-60 minutes during long sessions, or when a provider runs low or hits a limit.
---

# Fuel Gauge

Each subscription has its own allowance (5-hourly, weekly, monthly). Fuel Gauge keeps an eye on all of them and spreads the work, so no allowance runs dry mid-job and none is left unused at the end of the week.

**What this skill does:** track usage per provider, and when assigning the next job, pick the provider with room at the **same tier** of model the job needs.

**What it does NOT do:** decide which tier a job needs (the orchestrator does that), or fix an order of providers. Providers are chosen on the fly from the latest readings.

## 1. Think in tiers, not model names

Model and provider names change every few months. Always reason in tiers, and treat the table below as an example to adapt to the owner's subscriptions.

| Tier | Meaning | Claude | Codex (ChatGPT) | Antigravity (Gemini) |
|---|---|---|---|---|
| Top | Hardest reasoning, big redesigns, deep reviews | Fable | Astra (`gpt-6.2-astra`) | Neon (`gemini-4-neon-high`) |
| Strong | Everyday serious work: features, bugs, design | Opus | Sol (`gpt-6.2-sol`) | Neon (`gemini-4-neon-medium`/`-high`) |
| Efficient | Routine, bulk, mechanical: releases, translations, simple edits | Sonnet | Luna / Terra (`gpt-6-luna`, `gpt-6.1-terra`) | Hydrogen (`gemini-4-hydrogen-sonar`) |

Haiku-class models aren't used in this setup. When names change, update the table from the provider's own model list (e.g. `codex debug models`) and note the date.

**Default effort: medium** for every model, unless the owner says otherwise.

## 2. Subscriptions first, APIs last

- **Time-limited subscriptions** (5-hourly / weekly / monthly allowances) are already paid for. Unused allowance at reset is money left on the table. Spend these first.
- **Pay-per-use APIs** cost real money for every call. Use them **only when every subscription that can do the job's tier is out**, unless the owner overrides this.
- Current providers (these WILL change):
  - Subscriptions: **Claude**, **Codex/ChatGPT** (availability depends on the account), **Antigravity**.
  - API (last resort): **DeepSeek** (V4.1 Flash via the DeepSeek API and harness).

## 3. Reading the gauges

1. First use `~/.local/share/fuel-gauge/latest.json` if its `updatedAt` is within twice its `refreshMinutes` (30 minutes at the default setting). Run `scripts/read-usage.sh` to check freshness, print the reading and check for providers that went quiet.
2. If the snapshot is missing or stale, the script falls back to local transcripts. It can read unexpired Codex windows from session logs and active limit rejections from Claude Code. A Codex log reading reflects the time of the last recorded turn. Antigravity quota and DeepSeek balance need the plugin or an owner reading.
3. If the readings you need are still unavailable, ask the owner for numbers or a screenshot of Orca's **Usage** tab. Ask at most every hour or two, when a routing decision depends on it. Models cannot see their own account limits.

The script records each reading in `~/.local/share/fuel-gauge/readings.jsonl` and keeps the last 500 lines for burn-rate comparisons. For a manual reading, pass `--record-owner '<providers JSON>'` with the snapshot's provider shape. The script records it with `source: "owner"`.

### Provider went quiet

Relay a new "stopped reporting" notice from the script to the owner once, with its suggested fix. A notice is based on a fresh plugin snapshot and a previous successful reading (`lastOkAt`). A provider can trigger a new notice after it recovers and fails again. Treat a stale snapshot as a reason to fall back to local readings.

If the owner says they no longer uses a provider, add its ID (`claude`, `codex`, `antigravity` or `deepseek`) to the JSON array in `~/.local/share/fuel-gauge/ignored-providers.json`. Preserve other entries. The skill and plugin will skip it. Remove the ID from that array to re-enable it.

## 4. Pace: how often to check

- Check every **30-60 minutes** during active work, before starting a big job, and whenever a worker reports a rate-limit error.
- From two readings, estimate the burn rate: `(% now - % before) / hours between`, then the time to empty, and compare it to the time until reset.
  - Will empty before reset → move the next jobs of that tier elsewhere.
  - Will reset with lots left → steer more work onto it (that's free capacity about to vanish).

## 5. Routing the next job

1. The orchestrator decides the job's **tier** (not this skill).
2. Look up that tier's model on each provider (section 1).
3. Drop providers that are out, or will run out before the job likely finishes.
4. Of the rest, prefer subscriptions whose allowance resets **soonest** with the **most left** (use it or lose it), then any other subscription. An API only if nothing else is left.
5. Keep the tier the same. If no provider has room at that tier, tell the owner the options (wait for a reset, drop a tier, or use the API) rather than silently downgrading or spending money.
6. Mention the switch in one line when reporting: e.g. "Codex was nearly out, so this went to Neon (same tier)."

## 6. Overrides

The owner can override anything: name a model, a provider, a tier, an effort level, or allow the API early. The owner's instruction wins until they change it.
