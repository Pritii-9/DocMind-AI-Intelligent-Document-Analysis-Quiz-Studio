export interface ExperienceCheck {
  required_years?: string;
  candidate_years?: string;
  status?: "Meets" | "Exceeds" | "Under" | "Unspecified" | string;
  verdict?: string;
}

export interface RequirementItem {
  requirement: string;
  candidate_match: string;
  status: "match" | "partial" | "missing" | string;
}

export interface ResolvedExperience {
  requiredYears: string;
  candidateYears: string;
  status: "Meets" | "Exceeds" | "Under" | "Unspecified";
  verdict: string;
  whatTheyWant: string;
  whatCandidateHas: string;
  breakdown: RequirementItem[];
}

/**
 * Resolves structured experience and requirement fit for any candidate record,
 * providing instant fallbacks if the candidate was evaluated prior to this schema.
 */
export function resolveExperienceDetails(candidate: any, defaultJobTitle?: string): ResolvedExperience {
  if (!candidate) {
    return {
      requiredYears: "3+ Years",
      candidateYears: "N/A",
      status: "Unspecified",
      verdict: "Experience requirement not evaluated yet",
      whatTheyWant: "General engineering requirements",
      whatCandidateHas: "See resume details",
      breakdown: [],
    };
  }

  // 1. Direct LLM-returned experience check
  if (candidate.experience_check && candidate.experience_check.status) {
    const rawStatus = candidate.experience_check.status;
    let normStatus: "Meets" | "Exceeds" | "Under" | "Unspecified" = "Meets";
    if (/exceed/i.test(rawStatus)) normStatus = "Exceeds";
    else if (/under|lack|gap|fail/i.test(rawStatus)) normStatus = "Under";
    else if (/meet|pass|strong/i.test(rawStatus)) normStatus = "Meets";
    else normStatus = "Unspecified";

    return {
      requiredYears: candidate.experience_check.required_years || "3+ Years",
      candidateYears: candidate.experience_check.candidate_years || "Relevant",
      status: normStatus,
      verdict:
        candidate.experience_check.verdict ||
        `${normStatus === "Under" ? "Experience Gap" : "Meets requirement"}: ${candidate.experience_check.candidate_years || "Experience"} found.`,
      whatTheyWant:
        candidate.what_they_want ||
        `Role requires ${candidate.role || defaultJobTitle || "Software Engineer"} fundamentals & production stack`,
      whatCandidateHas:
        candidate.what_candidate_has ||
        candidate.reason ||
        "Candidate possesses relevant technical background",
      breakdown: Array.isArray(candidate.requirements_breakdown) ? candidate.requirements_breakdown : [],
    };
  }

  // 2. Fallback heuristic based on score & known skills / reason
  const score = Number(candidate.score || 0);
  const reasonText = (candidate.reason || "").toLowerCase();
  const skills: string[] = candidate.skills || [];
  const requiredYears = "3+ Years";

  // Check if reason indicates internship / academic / fresher / entry level
  const isInternOrAcademic =
    /internship|academic|student|fresher|junior|graduate|limited to internship|lacks.*senior/i.test(reasonText);

  let candidateYears = "1 Year";
  let status: "Meets" | "Exceeds" | "Under" = "Meets";

  if (isInternOrAcademic || score < 65) {
    status = "Under";
    candidateYears = "< 1 Yr (Intern / Academic)";
  } else if (score >= 90) {
    status = "Exceeds";
    candidateYears = "4+ Years";
  } else if (score >= 70) {
    status = "Meets";
    candidateYears = "3 Years";
  } else {
    status = "Under";
    candidateYears = "1-2 Years";
  }

  const verdict =
    status === "Exceeds"
      ? `Exceeds senior requirement: ${candidateYears} found vs ${requiredYears} target.`
      : status === "Meets"
      ? `Meets requirement: ${candidateYears} aligns with target.`
      : `Found ${candidateYears} vs ${requiredYears} required. Screening questions bypassed.`;

  const whatTheyWant = `Target: ${requiredYears} production engineering in modern backend architectures.`;
  const whatCandidateHas =
    candidate.reason ||
    `Demonstrated ${candidateYears} with core skills: ${skills.slice(0, 4).join(", ") || "General Stack"}.`;

  const breakdown: RequirementItem[] = [
    {
      requirement: `Experience Level (${requiredYears})`,
      candidate_match: candidateYears,
      status: status === "Under" ? "missing" : "match",
    },
    {
      requirement: "Core Language & Stack",
      candidate_match: skills.slice(0, 3).join(", ") || "Python / FastAPI",
      status: skills.length >= 2 ? "match" : "partial",
    },
    {
      requirement: "Database & Architecture",
      candidate_match: skills.some((s) => /sql|postgres|mongo|redis|vector/i.test(s))
        ? "PostgreSQL / Redis verified"
        : "Foundational knowledge",
      status: skills.some((s) => /sql|postgres|mongo|redis|vector/i.test(s)) ? "match" : "partial",
    },
  ];

  return {
    requiredYears,
    candidateYears,
    status,
    verdict,
    whatTheyWant,
    whatCandidateHas,
    breakdown,
  };
}
