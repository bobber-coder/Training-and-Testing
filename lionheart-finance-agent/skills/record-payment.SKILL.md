---
name: lionheart-record-payment
description: Record a payment against a Zoho Books invoice in one message — the fix for Wave's click-this-click-that.
version: 0.1.0
author: Lionheart Productions
license: MIT
platforms: [macos]
metadata:
  hermes:
    tags: [Finance, Payments, Invoicing]
    requires_toolsets: [terminal]
required_environment_variables:
  - name: LIONHEART_DIR
    prompt: "Absolute path to the cloned lionheart-finance-agent repo"
    required_for: "locating helper scripts"
  - name: ZOHO_REFRESH_TOKEN
    prompt: "Zoho Books OAuth refresh token"
    required_for: "recording payments"
  - name: LIONHEART_SHEET_ID
    prompt: "Google Sheet ID for the ledger mirror"
    required_for: "updating the ledger/dashboard"
required_credential_files:
  - path: ${GOOGLE_SERVICE_ACCOUNT_FILE}
    description: "Google service-account JSON with Sheets access"
---

# Record Payment

## When to Use
"Mark the <client> invoice paid", "<client> paid $X", "record a $X payment on
invoice #N". (Stripe can also trigger this automatically — see `bank-sync` /
Stripe webhook notes in SETUP.)

## Quick Reference
`python "$LIONHEART_DIR/scripts/zoho_client.py" record_payment --invoice_id <id> --amount <n> [--date yyyy-mm-dd] [--mode <cash|card|etransfer>]`

## Procedure
1. **Identify the invoice.** If the user gives a number, use it. If they give a
   client name, find the open invoice for that client (look it up in Zoho or the
   `Invoices` Sheet tab). If multiple are open, ask which one.
2. **Amount:** default to the invoice balance for "paid"/"paid in full"; use the
   stated amount for partial payments.
3. **Record** via `record_payment`.
4. **Update Sheets:** set the invoice `stage`=paid (or partial) and `balance_due`;
   append an income row to `Ledger`; let `Dashboard` refresh.
5. **Reply** in one line: "Recorded $1,200 from Maria on inv #1043 — paid in full ✓".

## Pitfalls
- Partial vs full — don't mark fully paid on a partial amount.
- e-Transfer is common for Lionheart; default `--mode etransfer` if the user says
  "e-transfer/Interac".
- Avoid duplicate payments — check the invoice isn't already paid first.

## Verification
Invoice shows paid/partial in Zoho with the payment recorded; `Invoices` +
`Ledger` rows updated; reply confirms amount + invoice number.
