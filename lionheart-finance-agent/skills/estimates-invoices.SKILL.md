---
name: lionheart-estimates-invoices
description: Create, send, and convert estimates and invoices in Zoho Books from a plain-language request.
version: 0.1.0
author: Lionheart Productions
license: MIT
platforms: [macos]
metadata:
  hermes:
    tags: [Finance, Invoicing, Estimates, Sales]
    requires_toolsets: [terminal]
required_environment_variables:
  - name: LIONHEART_DIR
    prompt: "Absolute path to the cloned lionheart-finance-agent repo"
    required_for: "locating helper scripts"
  - name: ZOHO_REFRESH_TOKEN
    prompt: "Zoho Books OAuth refresh token"
    help: "https://api-console.zoho.com"
    required_for: "creating estimates/invoices"
  - name: LIONHEART_SHEET_ID
    prompt: "Google Sheet ID for the ledger mirror"
    required_for: "logging the invoice row"
required_credential_files:
  - path: ${GOOGLE_SERVICE_ACCOUNT_FILE}
    description: "Google service-account JSON with Sheets access"
---

# Estimates & Invoices

## When to Use
"Estimate/quote <client> $<amount> for <work>", "send an invoice to <client>",
"turn that estimate into an invoice", "<client> accepted the quote".

## Quick Reference
| Action | Command |
|--------|---------|
| Estimate | `python "$LIONHEART_DIR/scripts/zoho_client.py" create_estimate --customer "<c>" --item "<desc>" --rate <n> --quantity <q>` |
| Invoice | `python "$LIONHEART_DIR/scripts/zoho_client.py" create_invoice --customer "<c>" --item "<desc>" --rate <n> --quantity <q>` |
| Convert | `python "$LIONHEART_DIR/scripts/zoho_client.py" convert_estimate --estimate_id <id>` |

## Procedure
1. **Parse intent:** customer, line item description, rate, quantity. If a
   **deposit** is mentioned (e.g. "50% deposit"), note it for a follow-up invoice or
   a deposit line — confirm handling if ambiguous.
2. **Estimate vs invoice:** "quote/estimate" → estimate; "invoice/bill" → invoice.
3. **Create** via the matching command; capture the returned id and number.
4. **Send** it (Zoho send endpoint; ⚠️ VALIDATE exact call) unless the user said
   "draft only".
5. On **"accepted"/"convert"**, run `convert_estimate` with the estimate id.
6. **Log to Sheets** `Invoices`: `[date, client, number, stage, amount, balance_due, zoho_id]`.
7. **Reply** with the number, client, amount, and stage (sent/draft/converted).

## Pitfalls
- Confirm the **customer exists** in Zoho; if not, the helper creates by name —
  watch for duplicate-name customers.
- Deposits/retainers: don't silently invoice the full amount when the user wanted a
  partial deposit — ask.
- Keep currency CAD unless told otherwise.

## Verification
Estimate/invoice appears in Zoho with the right client and total; a row exists in
the `Invoices` tab; reply names the document number.
