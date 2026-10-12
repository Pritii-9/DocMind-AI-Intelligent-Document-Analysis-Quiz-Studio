"""
HireMind - LLM Screening Service
Uses Groq llama-3.1-70b-versatile via existing LangChain + ChatGroq infrastructure
to score candidates and generate technical screening questions.
"""
import json
import re

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

from config import settings

# ── Model preference: prefer llama-3.1-70b, fall back gracefully ──────────────
HIRE_MODELS = [
    "llama-3.1-70b-versatile",
    "llama-3.3-70b-versatile",
    "llama3-70b-8192",
    settings.GROQ_CHAT_MODEL,
    "groq/compound",
]


def _hire_chat(prompt: str, system: str, temperature: float = 0.3) -> str:
    """
    Invoke Groq with fallback model cascade.
    Returns raw string content from the LLM.
    """
    lc_msgs = [SystemMessage(content=system), HumanMessage(content=prompt)]

    last_error = None
    tried = set()
    for model_name in HIRE_MODELS:
        if model_name in tried:
            continue
        tried.add(model_name)
        try:
            llm = ChatGroq(
                api_key=settings.GROQ_API_KEY,
                model_name=model_name,
                temperature=temperature,
                timeout=settings.GROQ_TIMEOUT_SECONDS,
            )
            return llm.invoke(lc_msgs).content.strip()
        except Exception as e:
            err = str(e)
            if "NotFoundError" in err or "model_not_found" in err or "404" in err:
                last_error = e
                continue
            raise e

    if last_error:
        raise last_error
    raise RuntimeError("All Groq models exhausted without a successful response.")


def _parse_json_from_response(raw: str) -> dict | list:
    """Strip markdown fences and parse JSON from LLM response."""
    raw = raw.strip()
    # Remove ```json ... ``` or ``` ... ``` fences
    if raw.startswith("```"):
        parts = raw.split("```")
        # Find the JSON portion (index 1 or 2)
        for part in parts[1:]:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            if part:
                raw = part
                break
    raw = raw.strip().rstrip("`").strip()
    return json.loads(raw)


# ── 1. Candidate Screening ─────────────────────────────────────────────────────

SCREEN_SYSTEM = (
    "You are a senior technical recruiter at a startup. "
    "You evaluate candidates objectively based on job description match, resume skills, "
    "and GitHub activity. You respond ONLY with valid JSON — no markdown, no explanation."
)

SCREEN_PROMPT_TEMPLATE = """Evaluate this tech candidate for the role below.

JOB DESCRIPTION:
{jd}

RESUME TEXT:
{resume_text}

GITHUB DATA:
{github_data}

Score the candidate 0-100 where:
- 90-100: Exceptional fit, immediate shortlist
- 70-89:  Strong candidate, worth interviewing
- 50-69:  Partial fit, consider with caveats
- 0-49:   Not a fit for this role

Return ONLY this JSON:
{{
  "score": <integer 0-100>,
  "reason": "<2-3 sentence explanation of score including strengths and gaps>",
  "shortlist": <true if score >= 70, else false>,
  "skills_found": ["<skill1>", "<skill2>", "..."],
  "github_highlights": "<1 sentence summary of GitHub activity relevance>",
  "recommendation": "<one of: Strong Hire | Hire | Maybe | No Hire>"
}}
"""


def screen_candidate(jd: str, resume_text: str, github_data: dict) -> dict:
    """
    Screen a candidate against a job description using Groq LLM.

    Args:
        jd: Full job description text
        resume_text: Extracted text from candidate's resume PDF
        github_data: Structured dict from github_service.fetch_github_data()

    Returns:
        Parsed JSON dict with score, reason, shortlist, skills_found, etc.
    """
    # Format GitHub data as readable text for the prompt
    gh_summary = _format_github_for_prompt(github_data)

    # Trim inputs to avoid token overflows
    jd_trimmed = (jd or "").strip()[:3000]
    resume_trimmed = (resume_text or "").strip()[:5000]

    prompt = SCREEN_PROMPT_TEMPLATE.format(
        jd=jd_trimmed,
        resume_text=resume_trimmed,
        github_data=gh_summary,
    )

    raw = _hire_chat(prompt, system=SCREEN_SYSTEM, temperature=0.2)

    try:
        result = _parse_json_from_response(raw)
    except (json.JSONDecodeError, ValueError) as e:
        # Try to extract JSON block from messy response
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            result = json.loads(match.group(0))
        else:
            raise ValueError(f"LLM returned non-JSON screening result: {e}\nRaw: {raw[:300]}")

    return result


def _format_github_for_prompt(github_data: dict) -> str:
    """Convert github_data dict to a human-readable block for the prompt."""
    if not github_data or github_data.get("error"):
        error = (github_data or {}).get("error", "No GitHub data provided")
        return f"GitHub data unavailable: {error}"

    lines = [
        f"Username     : {github_data.get('username', 'N/A')}",
        f"Public Repos : {github_data.get('public_repos', 0)}",
        f"Followers    : {github_data.get('followers', 0)}",
        f"Top Languages: {', '.join(github_data.get('top_languages', []) or ['N/A'])}",
        f"Last Active  : {github_data.get('last_updated', 'N/A')}",
        "",
        "Recent Projects:",
    ]
    for r in (github_data.get("repos") or [])[:5]:
        lines.append(
            f"  - {r.get('name', '?')} [{r.get('language', '?')}] ⭐{r.get('stars', 0)}"
            f" — {r.get('description', '')}"
        )
    return "\n".join(lines)


# ── 2. Technical Screening Questions ─────────────────────────────────────────

QUESTIONS_SYSTEM = (
    "You are an expert technical interviewer at a startup. "
    "You craft specific, project-grounded screening questions — NOT generic ones. "
    "Your questions reference actual projects, technologies, and decisions from the candidate's resume. "
    "Respond ONLY with valid JSON — no markdown, no extra text."
)

QUESTIONS_PROMPT_TEMPLATE = """Generate 3 highly specific technical screening questions for this candidate.

JOB DESCRIPTION:
{jd}

CANDIDATE RESUME:
{resume_text}

Rules:
- Reference actual projects, tools, or decisions mentioned in the resume by name
- Each question should reveal depth of understanding, not just surface knowledge
- Tailor to the JD's requirements while grounding in candidate's real experience
- Example of GOOD question: "In your Luminary project using WebSockets, how did you handle reconnection logic and backpressure?"
- Example of BAD question: "What is React?" (too generic)

Return ONLY this JSON:
[
  {{
    "question": "<specific question referencing candidate's actual work>",
    "topic": "<topic area, e.g. 'System Design', 'Backend Architecture', 'DevOps'>",
    "difficulty": "<Easy | Medium | Hard>"
  }},
  {{
    "question": "...",
    "topic": "...",
    "difficulty": "..."
  }},
  {{
    "question": "...",
    "topic": "...",
    "difficulty": "..."
  }}
]
"""


def generate_screening_questions(resume_text: str, jd: str) -> list[dict]:
    """
    Generate 3 custom technical screening questions based on candidate's resume.

    Args:
        resume_text: Full resume text
        jd: Job description text

    Returns:
        List of 3 question dicts: [{question, topic, difficulty}]
    """
    resume_trimmed = (resume_text or "").strip()[:5000]
    jd_trimmed = (jd or "").strip()[:2000]

    prompt = QUESTIONS_PROMPT_TEMPLATE.format(
        resume_text=resume_trimmed,
        jd=jd_trimmed,
    )

    raw = _hire_chat(prompt, system=QUESTIONS_SYSTEM, temperature=0.5)

    try:
        result = _parse_json_from_response(raw)
    except (json.JSONDecodeError, ValueError) as e:
        # Try to extract JSON array from response
        match = re.search(r"\[.*\]", raw, re.DOTALL)
        if match:
            result = json.loads(match.group(0))
        else:
            raise ValueError(f"LLM returned non-JSON questions: {e}\nRaw: {raw[:300]}")

    if not isinstance(result, list):
        raise ValueError("Expected a JSON array of questions")

    return result[:3]  # Ensure max 3 questions
