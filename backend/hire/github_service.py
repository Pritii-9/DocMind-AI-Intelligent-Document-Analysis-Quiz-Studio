"""
HireMind - GitHub Service
Fetches public profile + repo stats for a candidate's GitHub username.
Uses the GitHub public API (no token required for basic data; optional token raises rate limit).
"""
import os
import httpx
from typing import Optional

GITHUB_API = "https://api.github.com"


def _headers() -> dict:
    """Build request headers. Adds Authorization if GITHUB_TOKEN is set in env."""
    h = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = os.getenv("GITHUB_TOKEN", "")
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def fetch_github_data(username: str) -> dict:
    """
    Fetch public GitHub profile + top repos for a candidate.

    Returns a structured dict:
    {
        "username": str,
        "public_repos": int,
        "followers": int,
        "account_created": str,          # ISO date
        "last_updated": str,             # most recent repo push_at
        "top_languages": list[str],      # deduplicated, sorted by repo count
        "repos": [{"name", "language", "stars", "description", "pushed_at"}],
        "profile_url": str,
        "error": str | None              # set if API call failed
    }
    """
    username = (username or "").strip()
    if not username:
        return {"error": "GitHub username is required", "username": ""}

    try:
        with httpx.Client(timeout=10) as client:
            # ── 1. Profile ──────────────────────────────────────────────────
            profile_res = client.get(f"{GITHUB_API}/users/{username}", headers=_headers())
            if profile_res.status_code == 404:
                return {"error": f"GitHub user '{username}' not found", "username": username}
            if profile_res.status_code != 200:
                return {
                    "error": f"GitHub API error {profile_res.status_code}",
                    "username": username,
                }
            profile = profile_res.json()

            # ── 2. Repos (top 30 sorted by recently updated) ─────────────
            repos_res = client.get(
                f"{GITHUB_API}/users/{username}/repos",
                params={"sort": "pushed", "direction": "desc", "per_page": 30},
                headers=_headers(),
            )
            repos_raw = repos_res.json() if repos_res.status_code == 200 else []

        # ── 3. Process repos ───────────────────────────────────────────────
        # Count language occurrences
        lang_count: dict[str, int] = {}
        repos_summary = []
        last_push = ""

        for r in repos_raw:
            if r.get("fork"):
                # Skip forks to focus on original work
                continue
            lang = r.get("language") or "Unknown"
            lang_count[lang] = lang_count.get(lang, 0) + 1
            pushed = r.get("pushed_at", "")
            if pushed and (not last_push or pushed > last_push):
                last_push = pushed
            repos_summary.append({
                "name": r.get("name", ""),
                "language": lang,
                "stars": r.get("stargazers_count", 0),
                "description": (r.get("description") or "")[:120],
                "pushed_at": pushed,
            })

        # Sort languages by repo count (descending)
        top_languages = sorted(lang_count, key=lang_count.__getitem__, reverse=True)

        return {
            "username": username,
            "public_repos": profile.get("public_repos", 0),
            "followers": profile.get("followers", 0),
            "account_created": profile.get("created_at", ""),
            "last_updated": last_push or profile.get("updated_at", ""),
            "top_languages": top_languages[:6],   # cap at 6
            "repos": repos_summary[:10],           # top 10 non-fork repos
            "profile_url": f"https://github.com/{username}",
            "error": None,
        }

    except httpx.TimeoutException:
        return {"error": "GitHub API timed out. Try again.", "username": username}
    except Exception as e:
        return {"error": f"GitHub fetch failed: {str(e)}", "username": username}
