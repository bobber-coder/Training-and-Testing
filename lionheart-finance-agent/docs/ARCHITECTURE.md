# Architecture & Decisions

## Goal

One conversational brain for Lionheart Productions' finances/admin. You input by
typing, **pasting screenshots** (receipts, emails, invoices), or **voice via
Superwhisper** (voice→text). It records receipts, builds estimates/invoices,
records payments, reconciles the bank, and assembles a year-end tax pack — with as
few manual clicks as possible. The pain it removes: Wave's click-this-click-that
for every small action.

## The stack

| Layer | Choice | Why |
|-------|--------|-----|
| Brain / orchestrator | **Hermes Agent** (already on your Mac) | Has skills, tools, scheduling, messaging gateways, vision, memory. It *is* an agent runtime — no separate orchestrator needed. |
| Memory | **Honcho** (already configured) | Peer-based long-term model of you + the business. |
| Interface | **Telegram** (already wired) + Hermes desktop + **Superwhisper** | Mobile + Mac; screenshots are first-class via Hermes vision. No voice-agent needed. |
| Ledger (truth) | **Zoho Books Standard** (Canada) | Best automation surface: REST API + webhooks + Deluge custom functions; native GST/HST. |
| Human window | **Google Sheets** | Readable dashboard + ledger mirror + tax tab. Skills write it; you don't hand-edit. |
| Receipts | **Hermes vision** (screenshot → structured data) | Smarter than Zoho's limited paid autoscan; gets line items. |
| Banks | **Zoho ↔ Plaid feed** (RBC + Tangerine) | Read-only, tokenized, revocable. Bank login never touches Hermes. |
| Payments (optional) | **Stripe** | Webhook can auto-mark invoices paid. |

## Why no n8n

Hermes already provides what we'd have used n8n for: skills (HTTP/API calls with
credential files), scheduling, a Telegram gateway, and memory. Adding n8n would be
a second orchestrator to maintain — the "node graph to babysit" you wanted to
avoid. The only thing a **local** Hermes can't do well is catch **real-time
inbound webhooks** (it listens on `127.0.0.1` and sleeps with the Mac). We solve
that with **scheduled polling** (Hermes asks Zoho "anything new?" on a schedule),
which is plenty for a solo business. If you ever need true 24/7 real-time, run
Hermes in **remote/always-on mode** on a small server — still no n8n.

## Why not direct bank access

You asked about the agent reaching your RBC/Tangerine accounts directly. The safe,
*available* path is the **Zoho ↔ Plaid bank feed** (read-only transactions and
balances). Do **not** have the agent log into the banks directly — it's against
bank terms, brittle, and dangerous. The Plaid token (held by Zoho) is the security
boundary; **no raw bank credentials** ever live in skills or Honcho memory.

**Moving money is out of scope for now.** Canada's open-banking framework
(Consumer-Driven Banking) gives *read* access rolling out in 2026 and *payment
initiation* only around mid-2027, via accredited providers. So: **read +
auto-reconcile now; initiate payments later.**

## Evolvability

Each capability is a self-contained `SKILL.md`. To grow the system you add a
skill, not rebuild. Hermes also self-improves skills from use. Zoho stays the
stable ledger underneath; the brain and its skills evolve on top.

## Data flow examples

- **Receipt:** paste screenshot in Telegram → Hermes vision extracts
  merchant/date/tax/line-items + suggests a T2125 category → `record-payment`/
  `receipt-capture` skill posts a Zoho expense + attaches the image → appends a
  Sheets "Receipts" row → replies with the category it used.
- **Estimate → invoice → paid:** "Estimate Maria $1,200, 2-day brand shoot, 50%
  deposit" → Zoho estimate created + sent → on acceptance, convert to invoice →
  "mark it paid" (or Stripe webhook) records the payment. One message each.
- **Bank reconcile:** scheduled `bank-sync` polls Zoho's Plaid feed → surfaces new
  uncategorized transactions to Telegram → you confirm categories in chat.

## Security model (summary)

- Secrets live **only on the Mac**: `.env` + credential files (gitignored).
- Zoho/Google via OAuth credential files Hermes loads per-skill.
- Banks via Plaid-in-Zoho only; read-only; revocable from Zoho.
- This repo holds **no secrets** — just code and docs.
