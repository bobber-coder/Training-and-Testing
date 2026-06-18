# Setup — run this on your Mac (where Hermes lives)

This is the integration phase. The scaffold was authored in a cloud session; the
parts below can only happen on your Mac, next to Hermes. Items marked **⚠️
VALIDATE** are things to confirm against your installed Hermes version / Zoho
edition as you go.

## 0. Prerequisites
- Hermes Agent installed and running (desktop app), Telegram gateway working,
  Honcho connected. Confirm Hermes is using a **vision-capable model** (Claude/
  GPT/Gemini) — receipt capture needs it.
- Python 3.11+ and `git` on the Mac.

## 1. Clone + Python deps
```bash
git clone https://github.com/bobber-coder/lionheart-finance-agent.git
cd lionheart-finance-agent
python3 -m venv .venv && source .venv/bin/activate
pip install google-api-python-client google-auth   # for sheets_client.py
```

## 2. Zoho Books (the ledger)
1. Subscribe to **Zoho Books Standard** (Canada) — needed for API + bank feeds.
2. Set fiscal year + **GST/HST** settings (register a tax once you cross / choose to
   register for the $30k threshold).
3. Create an API client at https://api-console.zoho.com → **Self Client** → get
   `client_id`, `client_secret`. Generate a **refresh token** with Books scopes
   (`ZohoBooks.fullaccess.all` or narrower). ⚠️ VALIDATE your **data center** —
   set `ZOHO_API_DOMAIN`/`ZOHO_ACCOUNTS_DOMAIN` accordingly (.com vs .ca).
4. Grab your `organization_id` from Zoho Books settings.

## 3. Connect the banks (read-only)
In Zoho Books → **Banking** → connect **RBC** (personal + business chequing) and
**Tangerine** via the **Plaid** feed. This is read-only and revocable from Zoho.
Do **not** put bank credentials anywhere in this repo or Hermes.

## 4. Google Sheet (the window)
1. Create a Sheet named "Lionheart Finance" with the tabs in
   [`../sheets/schema.md`](../sheets/schema.md).
2. Create a Google Cloud **service account**, download its JSON key to
   `./credentials/google-service-account.json` (gitignored).
3. **Share the Sheet** with the service-account email as **Editor**.
4. Put the spreadsheet ID in `.env` as `LIONHEART_SHEET_ID`.

## 5. Fill in `.env`
```bash
cp .env.example .env      # then edit
# set LIONHEART_DIR to this repo's absolute path on the Mac
python scripts/setup_check.py     # should print all ✓ for required items
```
Quick live test of the Zoho helper (creates a tiny test expense you can delete):
```bash
python scripts/zoho_client.py report --name pnl --from 2026-01-01 --to 2026-12-31
```

## 6. Install the skills into Hermes
The skills are in `skills/*.SKILL.md`. Install each (⚠️ VALIDATE the exact Hermes
CLI/flags for your version):
```bash
hermes skills install ./skills/receipt-capture.SKILL.md
hermes skills install ./skills/estimates-invoices.SKILL.md
hermes skills install ./skills/record-payment.SKILL.md
hermes skills install ./skills/bank-sync.SKILL.md
hermes skills install ./skills/tax-summary.SKILL.md
hermes skills install ./skills/tax-dossier.SKILL.md
```
Notes:
- Skills call the shared helpers via `"$LIONHEART_DIR/scripts/…"`, so make sure
  Hermes' shell environment has the `.env` values (export them, or load `.env` in
  Hermes' environment). ⚠️ VALIDATE how your Hermes passes env to skill terminal
  commands.
- The scheduled skills (`bank-sync`, `tax-summary`) use a `blueprint.schedule`
  field — ⚠️ VALIDATE Hermes' schedule syntax and adjust.
- Hermes can also install a skill from a **raw GitHub URL**, so once pushed you can
  install straight from this repo without cloning, if you prefer.

## 7. Smoke test (end to end)
1. **Receipt:** paste a receipt screenshot into Telegram → expect a Zoho expense
   (with image) + a `Receipts` row + a one-line confirmation naming the category.
2. **Estimate:** "Estimate Maria $1,200 for a 2-day brand shoot, 50% deposit" →
   estimate created + sent; `Invoices` row appears.
3. **Convert + pay:** accept → convert to invoice → "mark it paid" → payment
   recorded; `Dashboard` updates.
4. **Bank:** trigger `bank-sync` → a real RBC/Tangerine transaction is surfaced;
   categorize it from Telegram.
5. **Tax:** run `tax-dossier` for a date range → a dossier Doc/PDF link arrives.

## 8. Optional: Stripe auto-mark-paid
If you invoice via Stripe, add a Stripe webhook → a small always-on relay (or
Hermes in remote mode) → call the `record-payment` path. Skip if you record
payments by message; scheduled `bank-sync` will also catch deposits.

## Where secrets live
Only on this Mac: `.env` and `./credentials/*.json` (both gitignored). The repo
stays secret-free. To rotate, regenerate tokens in Zoho/Google and update `.env`.

## Troubleshooting
- `setup_check.py` shows ✗ → fill the missing `.env` value / credential file path.
- Zoho 401 → refresh token expired or wrong data center; re-check step 2.
- Sheets 403 → you didn't share the Sheet with the service-account email.
- Vision not reading receipts → confirm Hermes' active model is vision-capable.
