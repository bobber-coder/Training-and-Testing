#!/usr/bin/env python3
"""
Pre-flight check: confirms the environment + credential files are present before
you wire skills into Hermes. Does NOT print secret values. Run on the Mac after
copying .env.example -> .env and filling it in.

    python scripts/setup_check.py
"""
import os
import sys

REQUIRED_ENV = [
    "ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET", "ZOHO_REFRESH_TOKEN",
    "ZOHO_ORGANIZATION_ID", "ZOHO_API_DOMAIN", "ZOHO_ACCOUNTS_DOMAIN",
    "LIONHEART_SHEET_ID", "GOOGLE_SERVICE_ACCOUNT_FILE",
]
OPTIONAL_ENV = ["ANTHROPIC_API_KEY", "STRIPE_API_KEY", "STRIPE_WEBHOOK_SECRET",
                "GST_HST_REGISTERED", "GST_HST_NUMBER"]


def load_dotenv(path=".env"):
    if not os.path.exists(path):
        return
    for line in open(path):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


def main():
    load_dotenv()
    ok = True

    print("== Required environment ==")
    for k in REQUIRED_ENV:
        present = bool(os.environ.get(k))
        print(f"  [{'✓' if present else '✗'}] {k}")
        ok = ok and present

    print("== Optional environment ==")
    for k in OPTIONAL_ENV:
        print(f"  [{'✓' if os.environ.get(k) else '–'}] {k}")

    print("== Credential files ==")
    gsa = os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE", "")
    present = bool(gsa) and os.path.exists(gsa)
    print(f"  [{'✓' if present else '✗'}] Google service account file: {gsa or '(unset)'}")
    ok = ok and present

    print()
    if ok:
        print("All required config present. Next: install skills into Hermes (see docs/SETUP.md).")
        sys.exit(0)
    print("Missing required config above. Fill in .env / credential files, then re-run.")
    sys.exit(1)


if __name__ == "__main__":
    main()
