# Tax Pack — Canada Sole Proprietor (T2125 + GST/HST)

Lionheart is a **sole proprietorship**, so business income/expenses flow onto a
**T2125 (Statement of Business or Professional Activities)** filed *with* your
personal return. This doc defines how the agent keeps you tax-ready year-round so
filing is a review, not a scramble.

> ⚠️ This is an organizational aid, not tax advice. Confirm categories/credits
> with your accountant or current CRA guidance.

## Key Canada facts baked into the skills

- **GST/HST registration is mandatory once revenue hits $30,000** (rolling
  four-quarter test). Below that you're a "small supplier" — optional to register,
  but registering lets you claim **input tax credits (ITCs)** on business
  purchases. Config flag: `GST_HST_REGISTERED` in `.env`.
- **Deadlines:** self-employed filing due **June 15**; any **balance owed is due
  April 30**.
- Zoho Books has native GST/HST/PST/QST and a built-in **GST/HST Return** report,
  but **cannot file to the CRA directly** — it generates the return; you file via
  CRA My Business Account or your accountant and mark it filed.

## T2125 expense category map

Every expense the agent records is tagged to a T2125 line. Representative mapping
(extend as needed in `skills/receipt-capture.SKILL.md`):

| T2125 line | Typical Lionheart items |
|------------|-------------------------|
| Advertising | ads, promo, website hosting/domains |
| Meals & entertainment (50%) | client meals on shoots (note the 50% rule) |
| Insurance | gear/liability insurance |
| Office expenses | consumables, small supplies |
| Supplies | SD cards, gels, gaffer tape, batteries, props |
| Professional fees | accountant, legal |
| Contract labour | what you pay your crew (you track this in the Crew tabs) |
| Rent | studio/location rental |
| Telephone & utilities | phone, internet (business-use portion) |
| Motor vehicle (see worksheet) | mileage to/from shoots, parking, fuel |
| Business-use-of-home | home-office portion of rent/utilities |
| Capital cost allowance (CCA) | cameras, lenses, lighting, computers — capitalized, not expensed |

**Notes the agent should attach automatically:**
- Meals → flag the **50% deductible** rule.
- Big gear (cameras/lenses/computers) → route to **CCA / capital**, not a straight
  expense, and tag the asset class.
- Vehicle + home-office → accumulate the inputs (mileage log, home sq-ft %) so the
  year-end worksheet is ready.

## Crew payments (your guys)

You pay crew (cash / e-transfer) for production and editing. This is tracked
**internally** in the `Crew` / `CrewPayments` tabs via the `crew-pay` skill — who,
what, hours, rate, and running totals — purely for your own picture and to watch
people grow. It's **not** set up as a formal payroll/slip arrangement. If you ever
decide to formalize it, that's a conversation for the accountant.

## The "Tax Pack" the agent maintains

1. **Categorize at capture** — done by `receipt-capture`.
2. **Quarterly check-in** (`tax-summary`, scheduled): revenue vs. the $30k GST/HST
   threshold, GST/HST collected vs. ITCs, and an **estimated tax set-aside** so you
   don't get surprised. Posted to Telegram + the Sheets `TaxPack` tab.
3. **Year-end dossier** (`tax-dossier`): pulls Zoho's **P&L**,
   **expense-by-category**, and **GST/HST Return** report → produces:
   - a plain-English **narrative for the accountant**,
   - a **T2125-mapped expense summary**,
   - a **GST/HST summary**,
   - **linked receipt images**,
   - exported as a Google Doc/PDF.

## Two end-games (both supported)

- **Accountant:** hand them the dossier + grant **Zoho accountant access**.
- **DIY filing:** feed the dossier into **Wealthsimple Tax**, **TurboTax
  Self-Employed**, or **CloudTax** (AI slip extraction). The T2125 is part of the
  personal return in all of them.
