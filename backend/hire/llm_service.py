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

# ── Model preference: verified active Groq models ────────────────────────────
HIRE_MODELS = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b",
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
        if not model_name or model_name in tried:
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
            if any(
                phrase in err
                for phrase in [
                    "NotFoundError",
                    "model_not_found",
                    "404",
                    "decommissioned",
                    "model_decommissioned",
                ]
            ):
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

EXPERIENCE & REQUIREMENTS ASSESSMENT:
Compare candidate's actual years of experience and core skills directly with the job description requirements.
Flag experience fit upfront (Meets, Exceeds, Under, or Unspecified).

Score the candidate 0-100 where:
- 90-100: Exceptional fit, immediate shortlist
- 70-89:  Strong candidate, worth interviewing
- 50-69:  Partial fit, consider with caveats
- 0-49:   Not a fit for this role

Return ONLY this JSON:
{{
  "score": <integer 0-100>,
  "experience_check": {{
    "required_years": "<e.g. 3+ years or 5+ years or Not specified>",
    "candidate_years": "<e.g. 4 years or 1.5 years or Fresh Graduate>",
    "status": "<one of: Meets | Exceeds | Under | Unspecified>",
    "verdict": "<short 1-sentence verdict e.g. Meets requirement: 4 yrs found vs 3+ yrs required>"
  }},
  "what_they_want": "<1 short sentence summarizing role's primary must-haves>",
  "what_candidate_has": "<1 short sentence summarizing candidate's actual experience and core stack>",
  "requirements_breakdown": [
    {{"requirement": "<must-have skill/exp from JD>", "candidate_match": "<what candidate has>", "status": "<match | partial | missing>"}},
    {{"requirement": "<must-have skill/exp from JD>", "candidate_match": "<what candidate has>", "status": "<match | partial | missing>"}},
    {{"requirement": "<must-have skill/exp from JD>", "candidate_match": "<what candidate has>", "status": "<match | partial | missing>"}}
  ],
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

    # ── Senior Dev Short-Circuit / Fast-Fail Optimization ────────────────────
    # If candidate experience has a severe gap (e.g. internships vs 3+ yrs senior req),
    # short-circuit screening to save recruiter time and LLM compute.
    exp_info = result.get("experience_check") or {}
    exp_status = exp_info.get("status", "")
    reason_lower = (result.get("reason") or "").lower()

    is_severe_gap = (
        exp_status.lower() in {"under", "unspecified"} or
        bool(re.search(r"internship|academic|student|lack\w*\s+.*(?:senior|3\+|experience)|not\s+a\s+fit|gap|entry|fresher|limited to", reason_lower))
    )

    if is_severe_gap and result.get("score", 100) < 70:
        result["short_circuited"] = True
        result["score"] = min(result.get("score", 50), 55)
        result["shortlist"] = False
        result["recommendation"] = "Not a Fit (Experience Gap)"
        result["fast_fail_reason"] = (
            "Minimum commercial experience threshold not met for this senior opening. "
            "Candidate background is focused on internships/academic work. "
            "Technical screening questions bypassed to save engineering interview bandwidth."
        )

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
    "You are an expert technical interviewer and principal engineer at a tech startup. "
    "You craft specific, project-grounded screening questions covering three critical pillars: "
    "1) Core Language Fundamentals (e.g., Python list comprehensions, generators, memory, GIL; or JS/TS event loop, closures), "
    "2) Database & SQL Query Optimization (e.g., indexing strategies, join queries, transaction isolation), "
    "3) System Design & Architectural Thinking (e.g., caching with Redis, rate limiting, microservices, concurrency). "
    "Your questions reference actual projects, technologies, and decisions from the candidate's resume. "
    "Respond ONLY with valid JSON — no markdown, no extra text."
)

QUESTIONS_PROMPT_TEMPLATE = """Generate exactly 3 targeted technical screening questions for this candidate based on their resume and the JD.

JOB DESCRIPTION:
{jd}

CANDIDATE RESUME:
{resume_text}

Rules:
You MUST generate exactly 3 questions, each under one of these specific technical categories:

1. Category "Core Language Fundamentals":
   - Target candidate's primary programming language (e.g., for Python: ask about list comprehensions vs generators, memory efficiency, lambda/closures, GIL, typing/decorators; for JavaScript/TypeScript: event loop, async microtasks, closures, prototyping).
   - Ground the question in a project from their resume.
   - Example: "In your project using Python, when would you favor a generator expression over a list comprehension, and how does memory allocation differ?"

2. Category "Database & SQL Optimization":
   - Target SQL queries, query execution plans, indexing strategies (B-Tree, GIN, composite indexes), transactions, or database scaling.
   - Example: "In your PostgreSQL queries, how did you analyze slow query performance using EXPLAIN ANALYZE and design composite indexes to avoid table scans?"

3. Category "System Design & Architecture":
   - Target system design, distributed caching (Redis/Memcached), rate limiting, message queues, async background workers, or high-concurrency throughput.
   - Example: "How would you architect a distributed rate limiter or caching strategy to handle 10,000 requests/second with minimal latency?"

Return ONLY this JSON array with exactly 3 objects:
[
  {{
    "category": "Core Language Fundamentals",
    "topic": "<e.g. Python List Comprehensions & Generator Memory>",
    "question": "<specific technical question grounded in their primary language and work>",
    "difficulty": "<Easy | Medium | Hard>",
    "evaluation_criteria": "<1-2 sentence hint on what a strong senior answer must include>"
  }},
  {{
    "category": "Database & SQL Optimization",
    "topic": "<e.g. SQL Indexing & Query Execution Plans>",
    "question": "<specific technical question on SQL / database optimization>",
    "difficulty": "<Medium | Hard>",
    "evaluation_criteria": "<1-2 sentence hint on what to look for in candidate answer>"
  }},
  {{
    "category": "System Design & Architecture",
    "topic": "<e.g. Distributed Caching & High-Concurrency Throughput>",
    "question": "<specific system design & architectural thinking question>",
    "difficulty": "<Medium | Hard>",
    "evaluation_criteria": "<1-2 sentence hint on what architectural tradeoffs to assess>"
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
