"""
HireMind - Google Sheets Service
Appends a candidate screening row to a configured Google Sheet.

Behaviour:
- GOOGLE_CRED_JSON not set → mock log to console
- SHEET_ID not set but creds present → auto-creates the sheet, writes headers,
  saves the new Sheet ID back to .env so next run uses it directly
- Both set → appends row to existing sheet
"""
import json
import os
import re
from datetime import datetime, timezone

HEADERS = ["Timestamp", "Name", "Score", "GitHub", "Languages", "Questions"]


def _save_sheet_id_to_env(sheet_id: str):
    """Write SHEET_ID back into backend/.env so it persists across restarts."""
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    env_path = os.path.normpath(env_path)

    try:
        if os.path.isfile(env_path):
            content = open(env_path).read()
            if "SHEET_ID=" in content:
                # Replace existing empty or wrong value
                content = re.sub(r"SHEET_ID=.*", f"SHEET_ID={sheet_id}", content)
            else:
                content += f"\nSHEET_ID={sheet_id}\n"
            open(env_path, "w").write(content)
        print(f"[HireMind] Saved SHEET_ID={sheet_id} to .env")
    except Exception as e:
        print(f"[HireMind] Could not save SHEET_ID to .env: {e}")
        print(f"[HireMind] Manually add to .env: SHEET_ID={sheet_id}")


def log_candidate_to_sheets(
    name: str,
    score: int,
    github_data: dict,
    questions: list[str],
) -> dict:
    """
    Append a candidate row to Google Sheets.
    Auto-creates the sheet with headers if SHEET_ID is not configured.

    Row format: [Timestamp, Name, Score, GitHub URL, Languages, Questions]
    Returns: {"status": "logged" | "mocked" | "error", "message": str}
    """
    sheet_id = os.getenv("SHEET_ID", "").strip()
    cred_json = os.getenv("GOOGLE_CRED_JSON", "").strip()

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    github_url = github_data.get("profile_url", "") if github_data else ""
    # Format questions whether passed as strings or dict objects
    formatted_q = []
    for q in (questions or []):
        if isinstance(q, dict):
            formatted_q.append(q.get("question", str(q)))
        else:
            formatted_q.append(str(q))
    questions_text = " | ".join(formatted_q)
    languages = ", ".join(github_data.get("top_languages", [])) if github_data else ""
    row = [timestamp, name, score, github_url, languages, questions_text]

    # ── Mock mode: no credentials at all ──────────────────────────────────
    if not cred_json:
        print("[HireMind SHEETS MOCK] Would append row:")
        print(f"  Timestamp : {timestamp}")
        print(f"  Name      : {name}")
        print(f"  Score     : {score}")
        print(f"  GitHub    : {github_url}")
        print(f"  Languages : {languages}")
        print(f"  Questions : {questions_text}")
        return {
            "status": "mocked",
            "message": (
                "Google Sheets credentials not configured. "
                "Set GOOGLE_CRED_JSON in .env to enable real logging."
            ),
            "row": row,
        }

    # ── Real mode ─────────────────────────────────────────────────────────
    try:
        import gspread
        from google.oauth2.service_account import Credentials

        SCOPES = [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive",
        ]

        # Load credentials — file path or inline JSON string
        if os.path.isfile(cred_json):
            creds = Credentials.from_service_account_file(cred_json, scopes=SCOPES)
        else:
            creds = Credentials.from_service_account_info(
                json.loads(cred_json), scopes=SCOPES
            )

        gc = gspread.authorize(creds)

        # ── Auto-create sheet if SHEET_ID not set ─────────────────────────
        if not sheet_id:
            print("[HireMind] SHEET_ID not set — creating new sheet automatically...")
            spreadsheet = gc.create("HireMind Candidates")

            # Write headers on first row
            sheet = spreadsheet.sheet1
            sheet.append_row(HEADERS)

            # Save the new ID back to .env so next run skips creation
            new_id = spreadsheet.id
            _save_sheet_id_to_env(new_id)

            print(f"[HireMind] Sheet created: https://docs.google.com/spreadsheets/d/{new_id}")
            print("[HireMind] NOTE: Share this sheet with your Google account to view it.")
        else:
            # Use existing sheet
            sheet = gc.open_by_key(sheet_id).sheet1

        sheet.append_row(row)

        return {
            "status": "logged",
            "message": f"Candidate '{name}' logged to Google Sheet.",
            "sheet_url": f"https://docs.google.com/spreadsheets/d/{sheet_id or spreadsheet.id}",
            "row": row,
        }

    except ImportError:
        return {
            "status": "error",
            "message": "gspread not installed. Run: pip install gspread google-auth",
            "row": row,
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Google Sheets error: {str(e)}",
            "row": row,
        }
