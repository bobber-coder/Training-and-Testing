#!/usr/bin/env python3
"""
Thin Zoho Books API helper for the Lionheart finance skills.

Scaffold: covers OAuth token refresh and the handful of operations the skills
need (estimates, invoices, estimate->invoice convert, expenses + attachment,
record payment, pull tax/P&L reports). Credentials come from environment
variables (see .env.example). NOTHING here stores secrets.

⚠️ VALIDATE on the Mac: data-center domain (.com / .ca), organization_id, and the
exact field names for your Zoho Books edition. Endpoints follow Zoho Books API v3.

CLI usage (called by skills via terminal), examples:
    python zoho_client.py create_expense --merchant "Long & McQuade" \
        --date 2026-06-18 --amount 84.20 --tax 10.95 --account "Supplies"
    python zoho_client.py create_estimate --customer "Maria Lopez" \
        --item "Brand shoot (2 days)" --rate 1200 --quantity 1
    python zoho_client.py record_payment --invoice_id 12345 --amount 1200
    python zoho_client.py report --name gst_hst --from 2026-04-01 --to 2026-06-30
"""
import argparse
import json
import os
import sys
import time
from urllib import request, parse, error

ACCOUNTS = os.environ.get("ZOHO_ACCOUNTS_DOMAIN", "https://accounts.zoho.com")
API = os.environ.get("ZOHO_API_DOMAIN", "https://www.zohoapis.com")
ORG = os.environ.get("ZOHO_ORGANIZATION_ID", "")

_token_cache = {"access_token": None, "expires_at": 0}


def _refresh_access_token():
    """Exchange the long-lived refresh token for a short-lived access token."""
    if _token_cache["access_token"] and time.time() < _token_cache["expires_at"] - 60:
        return _token_cache["access_token"]
    data = parse.urlencode({
        "refresh_token": os.environ["ZOHO_REFRESH_TOKEN"],
        "client_id": os.environ["ZOHO_CLIENT_ID"],
        "client_secret": os.environ["ZOHO_CLIENT_SECRET"],
        "grant_type": "refresh_token",
    }).encode()
    req = request.Request(f"{ACCOUNTS}/oauth/v2/token", data=data, method="POST")
    with request.urlopen(req) as r:
        payload = json.loads(r.read())
    if "access_token" not in payload:
        raise RuntimeError(f"Zoho token refresh failed: {payload}")
    _token_cache["access_token"] = payload["access_token"]
    _token_cache["expires_at"] = time.time() + int(payload.get("expires_in", 3600))
    return _token_cache["access_token"]


def _call(method, path, body=None, params=None):
    token = _refresh_access_token()
    qs = dict(params or {})
    qs.setdefault("organization_id", ORG)
    url = f"{API}/books/v3/{path}?{parse.urlencode(qs)}"
    headers = {
        "Authorization": f"Zoho-oauthtoken {token}",
        "Content-Type": "application/json",
    }
    data = json.dumps(body).encode() if body is not None else None
    req = request.Request(url, data=data, method=method, headers=headers)
    try:
        with request.urlopen(req) as r:
            return json.loads(r.read())
    except error.HTTPError as e:
        sys.stderr.write(f"Zoho API error {e.code}: {e.read().decode()}\n")
        raise


# ---- Operations the skills use -------------------------------------------------

def create_expense(merchant, date, amount, tax=0, account="Supplies", notes=""):
    body = {
        "account_name": account,           # expense account / category
        "date": date,
        "amount": float(amount),
        "tax_amount": float(tax or 0),
        "vendor_name": merchant,
        "description": notes,
    }
    return _call("POST", "expenses", body)


def create_estimate(customer, item, rate, quantity=1):
    body = {
        "customer_name": customer,
        "line_items": [{"name": item, "rate": float(rate), "quantity": float(quantity)}],
    }
    return _call("POST", "estimates", body)


def create_invoice(customer, item, rate, quantity=1):
    body = {
        "customer_name": customer,
        "line_items": [{"name": item, "rate": float(rate), "quantity": float(quantity)}],
    }
    return _call("POST", "invoices", body)


def convert_estimate(estimate_id):
    # Zoho: convert an accepted estimate into an invoice.
    return _call("POST", f"estimates/{estimate_id}/converttoinvoice")


def record_payment(invoice_id, amount, date=None, mode="cash"):
    body = {
        "invoices": [{"invoice_id": invoice_id, "amount_applied": float(amount)}],
        "amount": float(amount),
        "date": date or time.strftime("%Y-%m-%d"),
        "payment_mode": mode,
    }
    return _call("POST", "customerpayments", body)


REPORTS = {
    "gst_hst": "reports/taxreturns",   # ⚠️ VALIDATE exact report path for your edition
    "pnl": "reports/profitandloss",
}


def report(name, date_from, date_to):
    path = REPORTS.get(name)
    if not path:
        raise SystemExit(f"unknown report '{name}'; known: {list(REPORTS)}")
    return _call("GET", path, params={"from_date": date_from, "to_date": date_to})


# ---- CLI ----------------------------------------------------------------------

def main():
    p = argparse.ArgumentParser(description="Zoho Books helper for Lionheart skills")
    sub = p.add_subparsers(dest="cmd", required=True)

    e = sub.add_parser("create_expense")
    e.add_argument("--merchant", required=True); e.add_argument("--date", required=True)
    e.add_argument("--amount", required=True); e.add_argument("--tax", default=0)
    e.add_argument("--account", default="Supplies"); e.add_argument("--notes", default="")

    es = sub.add_parser("create_estimate")
    es.add_argument("--customer", required=True); es.add_argument("--item", required=True)
    es.add_argument("--rate", required=True); es.add_argument("--quantity", default=1)

    iv = sub.add_parser("create_invoice")
    iv.add_argument("--customer", required=True); iv.add_argument("--item", required=True)
    iv.add_argument("--rate", required=True); iv.add_argument("--quantity", default=1)

    cv = sub.add_parser("convert_estimate"); cv.add_argument("--estimate_id", required=True)

    rp = sub.add_parser("record_payment")
    rp.add_argument("--invoice_id", required=True); rp.add_argument("--amount", required=True)
    rp.add_argument("--date", default=None); rp.add_argument("--mode", default="cash")

    rep = sub.add_parser("report")
    rep.add_argument("--name", required=True)
    rep.add_argument("--from", dest="date_from", required=True)
    rep.add_argument("--to", dest="date_to", required=True)

    a = p.parse_args()
    fn = {
        "create_expense": lambda: create_expense(a.merchant, a.date, a.amount, a.tax, a.account, a.notes),
        "create_estimate": lambda: create_estimate(a.customer, a.item, a.rate, a.quantity),
        "create_invoice": lambda: create_invoice(a.customer, a.item, a.rate, a.quantity),
        "convert_estimate": lambda: convert_estimate(a.estimate_id),
        "record_payment": lambda: record_payment(a.invoice_id, a.amount, a.date, a.mode),
        "report": lambda: report(a.name, a.date_from, a.date_to),
    }[a.cmd]
    print(json.dumps(fn(), indent=2))


if __name__ == "__main__":
    main()
