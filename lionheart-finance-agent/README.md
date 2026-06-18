# Lionheart Finance Agent

A conversational finance/admin "brain" for **Lionheart Productions** (a small
Canadian video/photography business). You talk to it (type, paste a screenshot,
or speak via Superwhisper), and it handles receipts, estimates, invoices,
payments, bank reconciliation, and year-end taxes — without the click-through
grind of doing it by hand in Wave.

This repo is the **source of truth for the code** (skills, helper scripts, docs).
The system itself **runs on your Mac**, inside your existing **Hermes Agent**.
Secrets never live in this repo — they stay on the Mac.

---

## How it fits together

```
 You ──(Telegram on phone / Hermes desktop on Mac / Superwhisper voice→text)──┐
                                                                              ▼
                                                   ┌─────────────────────────────┐
                                                   │  HERMES AGENT  + Honcho mem  │
                                                   │  (the brain: intent, vision  │
                                                   │   on screenshots, scheduling)│
                                                   └─────────────────────────────┘
                                                       │ runs skills (this repo)
                          ┌────────────────────────────┼────────────────────────────┐
                          ▼                            ▼                             ▼
                  Zoho Books API              Google Sheets API               Stripe (opt.)
                 (ledger = truth)          (human-readable window)          (payments rail)
                          │
                  Plaid bank feed  ◀── RBC + Tangerine (READ-ONLY, reconcile)
```

- **Zoho Books** is the system of record (real, tax-ready books).
- **Google Sheets** is the friendly window you actually look at (ledger mirror,
  cash position, outstanding invoices, tax tab). Skills write to it; you don't
  hand-edit the numbers.
- **Hermes** is the orchestrator. No n8n. Each capability is a Hermes **skill**
  (`skills/*.SKILL.md`). New capability = new skill, not a rebuild.
- **Banks** connect only through **Zoho's Plaid feed** (read-only). The agent
  reads finances by querying Zoho — your bank login never touches Hermes.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design and the
"why not n8n / why not direct bank access" reasoning.

## What's in here

| Path | What it is |
|------|------------|
| `skills/` | Hermes `SKILL.md` files — the actual capabilities |
| `scripts/` | Shared Python helpers the skills call (Zoho, Sheets, setup check) |
| `docs/SETUP.md` | Step-by-step **local Mac** setup (do this on the Mac) |
| `docs/ARCHITECTURE.md` | The design + decisions |
| `docs/TAX.md` | T2125 / GST-HST tax-pack mapping (Canada sole proprietor) |
| `sheets/schema.md` | Google Sheet tabs + columns |
| `.env.example` | Template for credentials (copy to `.env` on the Mac) |

## Quickstart (on your Mac)

> Full detail in [`docs/SETUP.md`](docs/SETUP.md). High level:

1. `git clone` this repo onto the Mac, next to your Hermes install.
2. `cp .env.example .env` and fill in Zoho + Google (+ optional Stripe) values.
3. Run `python scripts/setup_check.py` to confirm credentials load.
4. Install the skills into Hermes (`hermes skills install …` — see SETUP.md).
5. Smoke-test: paste a receipt screenshot in Telegram → confirm a Zoho expense +
   Sheets row appear.

## Status

🛠️ **Scaffold.** Authored in a cloud session and pushed for you to clone. The
integration steps (Hermes install, credential wiring, live testing) happen on the
Mac. Anything marked **⚠️ VALIDATE** in the docs should be confirmed against your
installed Hermes version.
