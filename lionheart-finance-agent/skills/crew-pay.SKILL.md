---
name: lxr-crew-pay
description: Track what you pay your crew ("your guys") — who, for what work, hours, rate, and running totals over time. Internal tracking only; cash / e-transfer.
version: 0.1.0
author: LXR Productions
license: MIT
platforms: [macos]
metadata:
  hermes:
    tags: [Finance, Crew, Tracking, Leadership]
    requires_toolsets: [terminal]
required_environment_variables:
  - name: LIONHEART_DIR
    prompt: "Absolute path to the cloned repo"
    required_for: "locating helper scripts"
  - name: LIONHEART_SHEET_ID
    prompt: "Google Sheet ID"
    required_for: "the crew ledger"
required_credential_files:
  - path: ${GOOGLE_SERVICE_ACCOUNT_FILE}
    description: "Google service-account JSON with Sheets access"
---

# Crew Pay — internal tracker for your guys

Just a private record of who you're paying and what they're doing — **not** an
official/payroll thing. Payments are cash or e-transfer, no tax added, no slips.
The point is to keep an honest ledger and watch people grow over time.

## When to Use
"Paid Marcus $400 for 2 edit days on the Nike job", "log a production day for
Dev", "what have I paid Sarah so far?", "Marcus's edit rate is $250/day now".

## Quick Reference
| Action | What to do |
|--------|------------|
| Log a payment | Append to `CrewPayments` + update the person's total in `Crew` |
| Append row | `python "$LIONHEART_DIR/scripts/sheets_client.py" append --tab CrewPayments --row '[…]'` |
| Review someone | Read `Crew` + `CrewPayments` and summarize their work + totals |

## Procedure
1. **Parse:** `name`, `project`/job, `work_type` (editing / production day / etc.),
   `hours`, `rate`, `amount`, `date`, and `paid_via` (cash / etransfer). If the rate
   isn't given, use their current rate from the `Crew` tab.
2. **New person?** If they're not in `Crew` yet, add a roster row (role, rate,
   start date) — confirm the rate with the user.
3. **Append a `CrewPayments` row:** `[date, name, project, work_type, hours, rate,
   amount, paid_via, status]` (`status` = paid / owed).
4. **Update `Crew`:** add to their running total; if the rate changed, append the
   date + new rate to `rate_history` — that's the growth record.
5. **Reply** in one line: "Logged $400 to Marcus — 2 edit days @ $200 on Nike;
   total so far $3,150 ✓".

## Leadership / growth view
On "review the crew" or whenever asked: per person, summarize what they've done,
total paid, days/hours, and how their rate has moved over time. Keep it simple and
factual — it's your own picture of who's leveling up.

## Optional
If you ever want your business cashflow to reflect these (it's money going out),
the skill *can* also drop a plain expense into Zoho — but that's off by default.
This stays a personal tracker unless you say otherwise.

## Pitfalls
- Don't double-log the same day — check recent `CrewPayments` rows.
- Track **paid vs owed** so you can see what you still owe someone.

## Verification
A `CrewPayments` row exists and the person's running total in `Crew` updated; the
reply states the amount + their total so far.
