---
name: lionheart-receipt-capture
description: Turn a pasted receipt screenshot/photo into a categorized Zoho Books expense plus a Google Sheets row.
version: 0.1.0
author: Lionheart Productions
license: MIT
platforms: [macos]
metadata:
  hermes:
    tags: [Finance, Receipts, Bookkeeping, Vision]
    requires_toolsets: [terminal]
    config:
      - key: lionheart.low_confidence_threshold
        description: Below this vision confidence, ask one follow-up before posting.
        default: "0.75"
        prompt: Confidence threshold for auto-posting receipts
required_environment_variables:
  - name: LIONHEART_DIR
    prompt: "Absolute path to the cloned lionheart-finance-agent repo"
    required_for: "locating helper scripts"
  - name: ZOHO_REFRESH_TOKEN
    prompt: "Zoho Books OAuth refresh token"
    help: "https://api-console.zoho.com"
    required_for: "posting expenses"
  - name: LIONHEART_SHEET_ID
    prompt: "Google Sheet ID for the ledger mirror"
    required_for: "logging the receipt row"
required_credential_files:
  - path: ${GOOGLE_SERVICE_ACCOUNT_FILE}
    description: "Google service-account JSON with Sheets access"
---

# Receipt Capture

## When to Use
The user pastes/sends a **screenshot or photo of a receipt** (or an emailed
receipt screenshot) and wants it recorded. Also triggers on phrases like "log this
receipt", "expense this", "this is a business purchase".

## Quick Reference
| Step | Command / action |
|------|------------------|
| Extract fields | Use your own vision on the pasted image (no external OCR) |
| Post expense | `python "$LIONHEART_DIR/scripts/zoho_client.py" create_expense …` |
| Log to Sheet | `python "$LIONHEART_DIR/scripts/sheets_client.py" append --tab Receipts --row '[…]'` |

## Procedure
1. **Read the image** with your vision capability. Extract: `merchant`, `date`
   (yyyy-mm-dd), `subtotal`, `gst_hst` (tax), `total`, and `line_items` if visible.
2. **Suggest a T2125 category** using `docs/TAX.md` (e.g. Supplies, Advertising,
   Meals (50%), Motor vehicle, CCA for big gear). Estimate a `confidence` 0–1.
3. **If confidence < `lionheart.low_confidence_threshold`**, ask the user ONE concise
   follow-up (e.g. "Is this Supplies or CCA/capital?") before posting. Otherwise
   proceed.
4. **Create the Zoho expense:**
   `python "$LIONHEART_DIR/scripts/zoho_client.py" create_expense --merchant "<m>" --date <d> --amount <total> --tax <gst_hst> --account "<category>" --notes "<short memo>"`
   Capture the returned expense id.
5. **Attach the image** to the expense in Zoho (use the attachment endpoint; ⚠️
   VALIDATE the exact call for your edition) so the receipt is stored with the books.
6. **Append a Sheets row** to `Receipts`:
   `[captured_at, merchant, date, total, gst_hst, t2125_category, confidence, zoho_expense_id, image_link]`.
7. **Reply** in one line: amount, merchant, the category you used, and that it's
   logged — e.g. "Logged $84.20 at Long & McQuade as **Supplies** ✓".

## Pitfalls
- **Meals** → flag the 50% deductibility; **cameras/lenses/computers** → route to
  **CCA/capital**, not a straight expense.
- Don't double-post if the user re-sends the same image — check the last few
  `Receipts` rows for a matching merchant+total+date.
- Never invent a total you can't read; ask instead.

## Verification
The reply states the merchant, amount, and category; a new row exists in the
`Receipts` tab; the expense is visible in Zoho Books with the image attached.
