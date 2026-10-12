"""
HireMind - Google Sheets Service
Appends a candidate screening row to a configured Google Sheet.
If GOOGLE_CRED_JSON or SHEET_ID env vars are not set, performs a mock log to console.
"""
import json
import os
from datetime import datetime, timezone


def log_candidate_to_sheets(
    name: str,
    score: int,
    github_data: dict,
    questions: list[str],
) -> dict:
    """
    Append a candidate row to Google Sheets.

    Row format: [Timestamp, Name, Score, GitHub URL, Languages, Questions]

    Returns: {"status": "logged" | "mocked", "message": str}
    """
    sheet_id = os.getenv("SHEET_ID", "")
    cred_json = os.getenv("GOOGLE_CRED_JSON", "")

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    github_url = github_data.get("profile_url", "") if github_data else ""
    languages = ", ".join(github_data.get("top_languages", [])) if github_data else ""
    questions_text = " | ".join(questions) if questions else ""

    row = [timestamp, name, score, github_url, languages, questions_text]

    # ── Mock mode: credentials not configured ─────────────────────────────
    if not sheet_id or not cred_json:
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
                "Set SHEET_ID and GOOGLE_CRED_JSON in .env to enable real logging."
            ),
            "row": row,
        }

    # ── Real mode: use gspread ────────────────────────────────────────────
    try:
        import gspread
        from google.oauth2.service_account import Credentials

        SCOPES = [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive",
        ]

        # GOOGLE_CRED_JSON can be either a file path or raw JSON string
        if os.path.isfile(cred_json):
            creds = Credentials.from_service_account_file(cred_json, scopes=SCOPES)
        else:
            # Treat as inline JSON
            cred_data = json.loads(cred_json)
            creds = Credentials.from_service_account_info(cred_data, scopes=SCOPES)

        gc = gspread.authorize(creds)
        sheet = gc.open_by_key(sheet_id).sheet1
        sheet.append_row(row)

        return {
            "status": "logged",
            "message": f"Candidate '{name}' logged to Google Sheet.",
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
