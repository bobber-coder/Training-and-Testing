# Google Sheet schema — "Lionheart Finance"

The Sheet is the **human-readable window**, written by the skills. Don't hand-edit
the numeric columns; treat Zoho Books as the source of truth and this as the
mirror/dashboard. One spreadsheet, the tabs below. Put the spreadsheet ID in
`.env` as `LIONHEART_SHEET_ID` and share the Sheet with the Google service-account
email as **Editor**.

## Tab: `Ledger`
Running log of every money event (income + expense), mirrored from Zoho.

| Column | Notes |
|--------|-------|
| date | ISO yyyy-mm-dd |
| type | income / expense |
| description | merchant or client + memo |
| category | T2125 category (expenses) / revenue stream (income) |
| amount | signed; CAD |
| gst_hst | tax portion |
| zoho_id | Zoho transaction id (back-reference) |
| source | receipt / invoice / bank-feed / manual |
| receipt_link | URL to attached image (if any) |

## Tab: `Invoices`
| Column | Notes |
|--------|-------|
| date | issue date |
| client | customer name |
| number | Zoho invoice/estimate number |
| stage | estimate / invoice / sent / paid / overdue |
| amount | CAD |
| balance_due | CAD |
| zoho_id | back-reference |

## Tab: `Receipts`
| Column | Notes |
|--------|-------|
| captured_at | when the screenshot was processed |
| merchant | extracted |
| date | receipt date |
| total | CAD |
| gst_hst | extracted tax |
| t2125_category | suggested category |
| confidence | vision confidence (0–1) — low values get a follow-up question |
| zoho_expense_id | back-reference |
| image_link | stored image URL |

## Tab: `Dashboard`
Formulas/summary the skills refresh: cash position, MTD/YTD income & expenses,
outstanding invoices total, overdue count.

## Tab: `TaxPack`
| Column | Notes |
|--------|-------|
| period | e.g. 2026-Q2 |
| revenue_to_date | rolling, for the $30k GST/HST test |
| gst_hst_collected | |
| input_tax_credits | |
| net_gst_hst | collected − ITCs |
| est_income_tax_setaside | suggested reserve |
| notes | threshold warnings, reminders (Jun 15 / Apr 30) |
