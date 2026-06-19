---
name: lionheart-tax-summary
description: Scheduled quarterly tax check-in — GST/HST threshold, collected vs ITCs, and a tax set-aside estimate.
version: 0.1.0
author: Lionheart Productions
license: MIT
platforms: [macos]
metadata:
  hermes:
    tags: [Finance, Tax, Scheduled, Canada]
    requires_toolsets: [terminal]
    blueprint:
      schedule: "quarterly"            # ⚠️ VALIDATE Hermes schedule syntax
      delivery: telegram
required_environment_variables:
  - name: LIONHEART_DIR
    prompt: "Absolute path to the cloned lionheart-finance-agent repo"
    required_for: "locating helper scripts"
  - name: ZOHO_REFRESH_TOKEN
    prompt: "Zoho Books OAuth refresh token"
    required_for: "pulling P&L / tax reports"
  - name: GST_HST_REGISTERED
    prompt: "Are you GST/HST registered? (true/false)"
    required_for: "threshold logic"
---

# Quarterly Tax Summary (Canada)

## When to Use
Runs quarterly (and on demand: "where am I on taxes?"). Keeps Lionheart ahead of
the $30k GST/HST threshold and the tax bill.

## Procedure
1. **Pull** YTD revenue and the GST/HST report from Zoho:
   `python "$LIONHEART_DIR/scripts/zoho_client.py" report --name gst_hst --from <q_start> --to <q_end>`
   and `--name pnl` for net income.
2. **Threshold check:** if not registered and **rolling 4-quarter revenue nears/
   exceeds $30,000**, warn clearly that GST/HST registration becomes mandatory.
3. **GST/HST position:** collected − input tax credits = net owing/refund.
4. **Tax set-aside:** estimate income-tax reserve on net business income (use a
   conservative marginal rate; this is an estimate, not advice).
5. **Write** a `TaxPack` row: `[period, revenue_to_date, gst_hst_collected,
   input_tax_credits, net_gst_hst, est_income_tax_setaside, notes]`.
6. **Telegram** a short summary + reminders (file by **Jun 15**, balance due
   **Apr 30**).

## Pitfalls
- Be explicit this is an estimate; recommend confirming with the accountant.
- Don't double-count GST/HST already remitted.

## Verification
A `TaxPack` row exists for the period and a clear Telegram summary was sent with the
threshold status and set-aside figure.
