---
name: lionheart-tax-dossier
description: Compile a year-end tax dossier (T2125-mapped summary, GST/HST, narrative, linked receipts) for the accountant or DIY filing.
version: 0.1.0
author: Lionheart Productions
license: MIT
platforms: [macos]
metadata:
  hermes:
    tags: [Finance, Tax, Reporting, Canada, YearEnd]
    requires_toolsets: [terminal]
required_environment_variables:
  - name: LIONHEART_DIR
    prompt: "Absolute path to the cloned lionheart-finance-agent repo"
    required_for: "locating helper scripts"
  - name: ZOHO_REFRESH_TOKEN
    prompt: "Zoho Books OAuth refresh token"
    required_for: "pulling year-end reports"
required_credential_files:
  - path: ${GOOGLE_SERVICE_ACCOUNT_FILE}
    description: "Google service-account JSON (to write the dossier doc)"
---

# Year-End Tax Dossier

## When to Use
"Build my tax pack", "get me ready for the accountant", "year-end taxes". Run after
the fiscal year (or for a clean interim package).

## Procedure
1. **Pull reports** from Zoho for the fiscal year:
   - P&L: `python "$LIONHEART_DIR/scripts/zoho_client.py" report --name pnl --from <fy_start> --to <fy_end>`
   - GST/HST: `--name gst_hst` for the same range.
   - Expense-by-category (from the ledger / Zoho).
2. **Map expenses to T2125 lines** using `docs/TAX.md`. Separate **CCA/capital**
   items (cameras, lenses, computers) from regular expenses; apply the **50% meals**
   rule; gather **vehicle** and **business-use-of-home** worksheet inputs.
3. **Write a plain-English narrative** for the accountant: what the business did
   this year, revenue streams, notable purchases, anything unusual to flag.
4. **Assemble the dossier** as a Google Doc/PDF containing:
   - the narrative,
   - the T2125-mapped expense summary table,
   - the GST/HST summary,
   - links to receipt images,
   - a **crew payments summary** (what you paid each person, from the `Crew` tab),
   - open questions for the accountant.
5. **Deliver** the link via Telegram with a one-paragraph cover note, and remind:
   Zoho **can't file to the CRA directly** — file via CRA My Business Account or the
   accountant, then mark filed.

## Pitfalls
- Don't expense capital assets — route to CCA with the asset class.
- Note the meals 50% rule and any personal-use adjustments (vehicle/home).
- Keep it review-ready: the human should be able to skim and trust it.

## Verification
A dossier Doc/PDF exists with narrative + T2125 summary + GST/HST + receipt links;
totals reconcile to Zoho's P&L; the link was delivered.
