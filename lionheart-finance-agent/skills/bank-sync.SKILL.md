---
name: lionheart-bank-sync
description: Scheduled poll of Zoho's Plaid bank feed (RBC + Tangerine) to surface and categorize new transactions.
version: 0.1.0
author: Lionheart Productions
license: MIT
platforms: [macos]
metadata:
  hermes:
    tags: [Finance, Banking, Reconciliation, Scheduled]
    requires_toolsets: [terminal]
    blueprint:
      schedule: "every 6 hours"        # ⚠️ VALIDATE Hermes schedule syntax
      delivery: telegram
required_environment_variables:
  - name: LIONHEART_DIR
    prompt: "Absolute path to the cloned lionheart-finance-agent repo"
    required_for: "locating helper scripts"
  - name: ZOHO_REFRESH_TOKEN
    prompt: "Zoho Books OAuth refresh token"
    required_for: "reading bank-feed transactions"
---

# Bank Sync (RBC + Tangerine via Zoho/Plaid)

## When to Use
Runs on a schedule (and on demand: "check the bank", "any new transactions?").
**Read-only.** The accounts are connected inside Zoho Books through Plaid; this
skill never touches bank logins.

## Quick Reference
Pull uncategorized/new bank transactions from Zoho's banking module (⚠️ VALIDATE the
exact Zoho banking endpoint for your edition) and propose categories.

## Procedure
1. **Fetch** new/uncategorized transactions from the Zoho bank feed since the last
   run (track a watermark date).
2. For each, **propose a T2125 category** (income vs expense; reuse `docs/TAX.md`
   mapping and past categorizations from Honcho memory).
3. **Auto-apply** high-confidence matches to existing invoices/expenses
   (reconcile); **list the uncertain ones** to the user in Telegram as a short
   numbered list for one-tap confirmation.
4. On confirmation, **categorize/reconcile** in Zoho and mirror to the `Ledger` tab.
5. **Summarize**: "3 reconciled, 2 need your call: …".

## Pitfalls
- This is **read + reconcile only** — never attempt payments/transfers (not
  available until Canada open-banking payment initiation, ~2027).
- Keep a watermark so you don't re-surface already-handled transactions.
- Personal vs business: RBC personal account items that are actually personal
  should be flagged, not booked as business expenses.

## Verification
New bank transactions appear categorized/reconciled in Zoho; uncertain ones were
surfaced to Telegram; `Ledger` reflects the reconciled items.
