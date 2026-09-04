---
name: "trae-work-checkin-plus"
description: "Daily Trae Work credit check-in (claim daily credits) and Trae Work balance/credit query using the user's local Trae login. Invoke when the user wants to check in for Trae Work daily credits, check Trae Work credit balance, or set up/run a daily Trae Work check-in."
---

# Trae Work Check-in Plus

Claim the daily Trae Work credit reward and query the current credit balance, using
the locally signed-in Trae / TraeWork desktop account. The scripts read the login
state from the local `storage.json`, refresh an expiring token automatically, and
call the client-observed Trae APIs. Scripts are idempotent and read/write only what
they must (a claim is deduplicated per day by the server).

## Workflow

1. Confirm the Trae / TraeWork desktop client is installed and signed in (the
   scripts read `iCubeAuthInfo://icube.cloudide` from its `globalStorage/storage.json`).
2. Run the check-in script to claim today's credit reward, or the balance script to
   read the credit balance and check-in status.
3. Report the result: whether it was already claimed, how many credits were gained
   (or remain), and the pack/entitlement list when querying the balance.

## Commands

Run from the skill root, on macOS, Linux, or Git Bash (Node.js ≥ 18 with global
`fetch` and `node:sqlite` not required; only `node:fs`, `node:crypto`, `node:os`):

```bash
node scripts/checkin.js     # query today's status; claim if not yet claimed
node scripts/checkin.js --json
node scripts/balance.js     # query credit balance (total / consumed / remaining / packs) + check-in status
node scripts/balance.js --json
```

The `--json` flag prints the raw API response for inspection.

## Authentication & Token Handling

- The token is derived by decrypting the local `tc`-format auth blob
  (`iCubeAuthInfo://icube.cloudide`), then auto-refreshed via the refresh token when
  near expiry.
- Keep the token in memory only. Never print, log, save, upload, or commit it.
- The scripts never write the token to disk and never print it.

## Idempotency & Failure Handling

- `checkin.js` first queries today's status. If already checked in, it stops and
  reports "already claimed" (no repeated claim). If not checked in, it calls the
  claim endpoint.
- Re-running on the same day is safe: the server deduplicates per day.
- On authentication failure, expired/unavailable balance, or an unexpected response,
  stop and report the failure reason. Do not retry in a loop and never fabricate a
  balance or a successful claim.

## Scheduling

The check-in is a short idempotent operation, suitable for a daily scheduled run
(e.g., once per day at a fixed local time). A scheduler may use a morning time; extra
fallback runs are optional and harmless due to idempotency.

## Safety boundaries

- Use only the user's own Trae / TraeWork account.
- Send requests only to the official Trae account/billing API hosts
  (e.g., `api.trae.cn` for the CN edition) using the standard Trae auth headers.
- Do not bypass login, CAPTCHA, SMS, or other security checks.
- Do not support bulk accounts or reward abuse.
- The APIs and the local decrypt routine are reverse-engineered from the official
  client and may change across releases; note this caveat when they stop working.
- The runtime scripts only operate on the local user's own account; package the
  skill for sharing as a `.zip` whose root contains `SKILL.md`, and do not include
  any runtime logs or personal data.