---
name: red-team
description: Run an adversarial security and abuse review — think like an attacker against the app and especially the scraper, credential handling, and any data egress. Enumerates threats with likelihood/impact ratings and mitigations. Use when the user asks to "red team", wants a "threat model", asks about the "attack surface", or wants to stress-test how the system could be abused or leaked.
---

# Skill: Red Team

An adversarial, attacker's-mindset review. Where `code-audit` looks for bugs and the
built-in `security-review` checks the pending diff, this skill steps back and asks "how
would someone abuse, exfiltrate, or break this?" — across the whole system, with special
attention to the **scraper, credential handling, and data egress**. It **complements** the
built-in `security-review`; run both for full coverage.

## Hard rule: this is read-only

Do **NOT** change code, configs, or secrets. Enumerate threats and mitigations only. If a
mitigation is worth implementing, recommend it — implementing is a separate, explicitly
requested step.

## Step 0 — Ground yourself in the real system first

Never threat-model from imagination. Map the actual attack surface:

- Recent and security-relevant history: `git log --oneline -20`, and look at what the live
  scraper backend added (e.g. `backend/`, `backend/lib/http.mjs`,
  `backend/lib/sources/`, the puppeteer/headless-browser driver).
- Find where credentials/secrets enter: search for env usage, config files, hardcoded
  tokens — `git grep -iE 'password|secret|token|api[_-]?key|credential|cookie'` and check
  `.gitignore` to confirm secret files aren't tracked.
- Trace data egress: every place data leaves the machine — outbound HTTP in the scraper,
  the optional Google-Doc integration, any upload. Confirm what the offline `Apex_*.html`
  tools claim ("no customer data leaves the machine") still holds.
- Note PII flows: property records, owner names, addresses — where they're read, stored,
  logged, and whether they could end up in logs/output/git.
- Surface any constraint (couldn't reach a file, dynamic code you couldn't fully trace) so
  the model isn't presented as exhaustive when it isn't.

## Threat categories to enumerate

Work through each; skip with a note only if genuinely N/A:

- **Credential leakage** — secrets in git history, logs, error messages, or shipped HTML;
  over-broad scope; plaintext storage.
- **Injection** — command/HTML/SQL/selector injection from scraped or user-supplied input;
  unsafe templating into the report or PDF.
- **SSRF / egress abuse** — scraper or fetch logic coerced into hitting internal/unintended
  hosts; unvalidated URLs.
- **Scraping exposure** — target-site ToS, rate-limit and anti-bot detection, IP/account
  bans, fingerprinting of the headless browser, legal/abuse risk.
- **PII handling** — owner/property data leaking into logs, caches, output files, or git;
  retention beyond need.
- **Secrets in git** — committed keys, tokens, cookies, or `.env`-style files; check history,
  not just the working tree.

## The report — a rated threat model

Lead with a one-line scope statement (what you mapped in Step 0). Then list each threat as:

- **Threat** — one concrete sentence (attacker + what they achieve), with `path:line` or the
  component where it lives.
- **Likelihood** — High / Medium / Low.
- **Impact** — High / Medium / Low.
- **Mitigation** — a specific, actionable fix or control.

Order by combined severity (highest first). Call out anything that is exploitable today vs.
theoretical.

## Style rules (encode these every time)
- Adversarial but honest: rate realistically; don't cry wolf, don't downplay real exposure.
- Grounded in the real surface from Step 0 — cite components/`path:line`, not generic advice.
- Tight and scannable: one threat per entry, each with likelihood/impact/mitigation.
- Read-only: enumerate and recommend; never expose a real secret in the report itself.
