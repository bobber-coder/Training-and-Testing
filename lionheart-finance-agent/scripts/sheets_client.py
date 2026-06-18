#!/usr/bin/env python3
"""
Google Sheets helper — append rows to the human-readable "Lionheart Finance" sheet.

Uses a Google service account (share the Sheet with the service-account email as
Editor). Secrets come from env (see .env.example): GOOGLE_SERVICE_ACCOUNT_FILE,
LIONHEART_SHEET_ID.

Dependency: `pip install google-api-python-client google-auth`
(Kept out of the repo; install on the Mac in a venv — see docs/SETUP.md.)

CLI (called by skills via terminal):
    python sheets_client.py append --tab Receipts \
        --row '["2026-06-18","Long & McQuade","2026-06-18","84.20","10.95","Supplies","0.97","",""]'
"""
import argparse
import json
import os
import sys


def _service():
    try:
        from google.oauth2.service_account import Credentials
        from googleapiclient.discovery import build
    except ImportError:
        sys.exit("Missing deps. Run: pip install google-api-python-client google-auth")
    creds = Credentials.from_service_account_file(
        os.environ["GOOGLE_SERVICE_ACCOUNT_FILE"],
        scopes=["https://www.googleapis.com/auth/spreadsheets"],
    )
    return build("sheets", "v4", credentials=creds).spreadsheets()


def append(tab, row):
    svc = _service()
    body = {"values": [row]}
    return svc.values().append(
        spreadsheetId=os.environ["LIONHEART_SHEET_ID"],
        range=f"{tab}!A1",
        valueInputOption="USER_ENTERED",
        insertDataOption="INSERT_ROWS",
        body=body,
    ).execute()


def main():
    p = argparse.ArgumentParser(description="Append a row to the Lionheart sheet")
    sub = p.add_subparsers(dest="cmd", required=True)
    ap = sub.add_parser("append")
    ap.add_argument("--tab", required=True)
    ap.add_argument("--row", required=True, help="JSON array of cell values")
    a = p.parse_args()
    if a.cmd == "append":
        row = json.loads(a.row)
        print(json.dumps(append(a.tab, row), indent=2))


if __name__ == "__main__":
    main()
