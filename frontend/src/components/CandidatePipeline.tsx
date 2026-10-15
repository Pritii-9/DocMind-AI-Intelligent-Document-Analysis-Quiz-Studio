import { useState, useEffect } from "react";
import {
  ExternalLink,
  Github,
  CheckCircle2,
  Search,
  Sparkles,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  Share2,
  AlertTriangle,
} from "lucide-react";
import ShareEvalModal from "./ShareEvalModal";
import ExperienceCheckCard from "./ExperienceCheckCard";
import TechQuestionCard from "./TechQuestionCard";
import { resolveExperienceDetails } from "../utils/experienceParser";

interface CandidateRecord {
  id: string;
  name: string;
  company?: string;
  role?: string;
  email?: string;
  github?: string;
  score: number;
  skills: string[];
  recommendation: string;
  reason?: string;
  questions?: Array<{ question: string; topic: string; difficulty: string }>;
  appliedAt: string;
  github_data?: any;
  short_circuited?: boolean;
}

const INITIAL_DEMO: CandidateRecord[] = [
  {
    id: "demo-1",
    name: "Priti Jadhav",
    email: "pritiijadhav95@gmail.com",
    github: "Pritii-9",
    role: "Associate Full-Stack AI Developer",
    score: 96,
    skills: ["Python", "FastAPI", "React", "TypeScript", "PostgreSQL", "Redis", "Docker", "AWS S3", "pgvector", "LangChain", "RAG"],
    recommendation: "Strong Hire",
    reason: "Exceptional full-stack AI project builder. Architected Luminary (telemetry with Redis Streams + FastAPI) and HireMind AI (LLM RAG with pgvector + Docker). Proven internship experience with REST APIs and Agile sprints.",
    questions: [
      { question: "In your Luminary project, how did you structure batch ingestion with Redis Streams to minimize PostgreSQL load?", topic: "Async Streams & Batch Processing", difficulty: "Medium" },
      { question: "How did you implement vector similarity search and metadata joins with pgvector in HireMind AI?", topic: "Vector Search & SQL Optimization", difficulty: "Hard" },
      { question: "How do you handle JWT authentication and role-based access control across FastAPI and React TypeScript?", topic: "Full-Stack Security & API Design", difficulty: "Medium" }
    ],
    appliedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    github_data: { public_repos: 18, followers: 42, top_languages: ["Python", "TypeScript", "JavaScript"] }
  },
  {
    id: "demo-2",
    name: "Alex Rivera",
    email: "alex.r@example.com",
    github: "alexrivera",
    role: "Backend Engineer",
    score: 78,
    skills: ["Python", "Django", "React", "Docker", "PostgreSQL"],
    recommendation: "Hire",
    reason: "Solid full-stack fundamentals with strong React and Python knowledge. Moderate GitHub activity with clean repository structure.",
    questions: [
      { question: "How do you handle schema migrations safely in zero-downtime PostgreSQL deployments?", topic: "DevOps / DB", difficulty: "Medium" },
      { question: "What state management pattern do you prefer in React when dealing with complex asynchronous flows?", topic: "Frontend Architecture", difficulty: "Medium" }
    ],
    appliedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    github_data: { public_repos: 14, followers: 32, top_languages: ["Python", "JavaScript"] }
  },
  {
    id: "demo-3",
    name: "Jordan Lee",
    email: "jordan.l@example.com",
    github: "jordanlee",
    role: "Frontend Developer",
    score: 48,
    skills: ["HTML", "CSS", "JavaScript", "PHP"],
    recommendation: "Not a Fit",
    reason: "Lacks required backend experience with Python, FastAPI, and modern cloud databases. No recent repository activity.",
    questions: [],
    appliedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    github_data: { public_repos: 3, followers: 2, top_languages: ["HTML", "PHP"] }
  }
];

export default function CandidatePipeline({ onSwitchToScreen }: { onSwitchToScreen?: () => void }) {
  const [candidates, setCandidates] = useState<CandidateRecord[]>([]);
  const [filter, setFilter] = useState<"all" | "shortlisted" | "reviewed">("all");
  const [expFilter, setExpFilter] = useState<"all" | "meets" | "under" | "senior">("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sharingCandidate, setSharingCandidate] = useState<CandidateRecord | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("hiremind_candidates");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.length > 0) {
          const merged = parsed.map((c: any) =>
            c.id === "demo-1"
              ? {
                  ...c,
                  role: INITIAL_DEMO[0].role,
                  skills: INITIAL_DEMO[0].skills,
                  email: INITIAL_DEMO[0].email,
                  github: INITIAL_DEMO[0].github,
                  reason: INITIAL_DEMO[0].reason,
                  questions: INITIAL_DEMO[0].questions,
                }
              : c
          );
          setCandidates(merged);
          return;
        }
      }
    } catch (e) {
      console.warn("Could not read stored candidates:", e);
    }
    setCandidates(INITIAL_DEMO);
    localStorage.setItem("hiremind_candidates", JSON.stringify(INITIAL_DEMO));
  }, []);

  const filtered = candidates.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.role && c.role.toLowerCase().includes(search.toLowerCase())) ||
      (c.skills && c.skills.some((s) => s.toLowerCase().includes(search.toLowerCase()))) ||
      (c.github && c.github.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;
    if (filter === "shortlisted" && c.score < 70) return false;
    if (filter === "reviewed" && c.score >= 70) return false;

    // Experience filter check
    if (expFilter !== "all") {
      const exp = resolveExperienceDetails(c);
      if (expFilter === "meets" && exp.status !== "Meets" && exp.status !== "Exceeds") return false;
      if (expFilter === "under" && exp.status !== "Under") return false;
      if (expFilter === "senior" && exp.status !== "Exceeds" && !/4\+|5\+|6\+|7\+|senior/i.test(exp.candidateYears)) return false;
    }

    return true;
  });

  const totalCount = candidates.length;
  const shortlistedCount = candidates.filter((c) => c.score >= 70).length;
  const avgScore = totalCount > 0 ? Math.round(candidates.reduce((a, b) => a + b.score, 0) / totalCount) : 0;

  const getScoreBadge = (score: number) => {
    if (score >= 80) return "bg-emerald-50/70 text-emerald-800 border-emerald-200/80";
    if (score >= 60) return "bg-amber-50/70 text-amber-800 border-amber-200/80";
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  return (
    <div className="px-6 py-5 max-w-7xl mx-auto space-y-3.5 font-[Inter,system-ui,sans-serif]">
      {/* ── Compact Header with Inline KPI Capsule ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-900 leading-tight">
              Dashboard
            </h1>
            <p className="text-xs text-slate-500">
              Talent intelligence, candidate evaluations &amp; pipeline tracking
            </p>
          </div>

          {/* High-density inline stats capsule (zero vertical space wasted) */}
          <div className="hidden md:flex items-center gap-2.5 bg-white border border-slate-200 px-3 py-1 rounded-lg text-xs shadow-2xs ml-3">
            <span className="text-slate-500">
              Total: <strong className="text-slate-900 font-semibold">{totalCount}</strong>
            </span>
            <span className="text-slate-200">|</span>
            <span className="text-slate-500">
              Shortlisted: <strong className="text-emerald-700 font-semibold">{shortlistedCount}</strong>
            </span>
            <span className="text-slate-200">|</span>
            <span className="text-slate-500">
              Avg Score: <strong className="text-slate-900 font-semibold">{avgScore}%</strong>
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <a
            href="https://docs.google.com/spreadsheets/d/1RsYvMSI8Nte2OU7uzSYTjqyBidwgXbXs9uC6IIttqUg"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 transition shadow-2xs"
            title="Open Live CRM Google Sheet"
          >
            <ExternalLink size={13} className="text-slate-400" />
            <span>CRM Sheet</span>
          </a>

          {onSwitchToScreen && (
            <button
              type="button"
              onClick={onSwitchToScreen}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition shadow-xs cursor-pointer active:scale-[0.99]"
            >
              <PlusCircle size={13} />
              <span>Quick Screen</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Single-Line Streamlined Toolbar (Search + Filters Inline) ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white border border-slate-200/90 px-3 py-2 rounded-lg shadow-2xs">
        {/* Compact Search Input */}
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search candidates, skills, roles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-7 pl-7 pr-2.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-400 transition"
          />
        </div>

        {/* Inline Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter Pills */}
          <div className="inline-flex p-0.5 bg-slate-100 rounded-md border border-slate-200/80 text-[11px]">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-2.5 py-0.5 rounded font-medium transition cursor-pointer ${
                filter === "all"
                  ? "bg-white text-slate-900 shadow-2xs font-semibold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              All ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter("shortlisted")}
              className={`px-2.5 py-0.5 rounded font-medium transition cursor-pointer ${
                filter === "shortlisted"
                  ? "bg-white text-slate-900 shadow-2xs font-semibold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Shortlisted ({shortlistedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter("reviewed")}
              className={`px-2.5 py-0.5 rounded font-medium transition cursor-pointer ${
                filter === "reviewed"
                  ? "bg-white text-slate-900 shadow-2xs font-semibold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Under Review ({totalCount - shortlistedCount})
            </button>
          </div>

          {/* Experience Filter Selector */}
          <div className="inline-flex p-0.5 bg-slate-100 rounded-md border border-slate-200/80 text-[11px]">
            <button
              type="button"
              onClick={() => setExpFilter("all")}
              className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                expFilter === "all"
                  ? "bg-white text-slate-900 shadow-2xs font-semibold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              All Exp
            </button>
            <button
              type="button"
              onClick={() => setExpFilter("meets")}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                expFilter === "meets"
                  ? "bg-white text-emerald-800 shadow-2xs font-semibold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <CheckCircle2 size={10} className="text-emerald-600" />
              <span>Meets</span>
            </button>
            <button
              type="button"
              onClick={() => setExpFilter("under")}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                expFilter === "under"
                  ? "bg-white text-amber-800 shadow-2xs font-semibold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <AlertTriangle size={10} className="text-amber-600" />
              <span>Exp Gap</span>
            </button>
            <button
              type="button"
              onClick={() => setExpFilter("senior")}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                expFilter === "senior"
                  ? "bg-white text-slate-900 shadow-2xs font-semibold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Sparkles size={10} className="text-slate-600" />
              <span>Senior 4y+</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── High-Density Candidate Data Table (Zero-Scroll Layout) ── */}
      <div className="bg-white border border-slate-200/90 rounded-lg overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-4 w-[28%]">Candidate</th>
                <th className="py-2.5 px-3 w-[10%]">Score</th>
                <th className="py-2.5 px-3 w-[18%]">Experience Status</th>
                <th className="py-2.5 px-3 w-[26%]">Verified Tech Stack</th>
                <th className="py-2.5 px-3 w-[10%]">Applied</th>
                <th className="py-2.5 px-4 w-[8%] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    No candidates match your current filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((candidate) => {
                  const isExpanded = expandedId === candidate.id;
                  const exp = resolveExperienceDetails(candidate, candidate.role);
                  const isExpGap = exp.status === "Under" || Boolean(candidate.short_circuited);
                  const isShortlisted = candidate.score >= 70 && !isExpGap;

                  return (
                    <tr key={candidate.id} className="group hover:bg-slate-50/60 transition-colors">
                      {/* Candidate Column: Name, Role, & Handles */}
                      <td className="py-2.5 px-4 align-middle">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0">
                            {candidate.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-900 text-xs block truncate">
                              {candidate.name}
                            </span>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate mt-0.5">
                              <span>{candidate.role || "Software Engineer"}</span>
                              {candidate.github && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <a
                                    href={`https://github.com/${candidate.github}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-0.5 text-slate-600 hover:text-slate-900 font-mono"
                                  >
                                    <Github size={10} />
                                    <span>@{candidate.github}</span>
                                  </a>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Score Column: Compact Pill */}
                      <td className="py-2.5 px-3 align-middle">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded font-mono font-semibold text-xs border ${getScoreBadge(
                            candidate.score
                          )}`}
                        >
                          {candidate.score}%
                        </span>
                      </td>

                      {/* Experience Status Column: Subtle Badge */}
                      <td className="py-2.5 px-3 align-middle">
                        {isExpGap ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-amber-50/80 text-amber-800 border border-amber-200/80">
                            <AlertTriangle size={11} className="text-amber-700" />
                            <span>Gap ({exp.candidateYears})</span>
                          </span>
                        ) : isShortlisted ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-50/80 text-emerald-800 border border-emerald-200/80">
                            <CheckCircle2 size={11} className="text-emerald-700" />
                            <span>Verified ({exp.candidateYears})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                            Under Review
                          </span>
                        )}
                      </td>

                      {/* Tech Stack Column: Compact Chips */}
                      <td className="py-2.5 px-3 align-middle">
                        <div className="flex items-center gap-1 flex-wrap">
                          {candidate.skills?.slice(0, 3).map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 rounded text-[10.5px] font-mono font-medium bg-slate-50 text-slate-700 border border-slate-200/80"
                            >
                              {skill}
                            </span>
                          ))}
                          {candidate.skills?.length > 3 && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              +{candidate.skills.length - 3}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Applied Column: Compact Date */}
                      <td className="py-2.5 px-3 align-middle text-slate-400 text-[11px] font-mono">
                        {new Date(candidate.appliedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>

                      {/* Actions Column: Share & Accordion Toggle */}
                      <td className="py-2.5 px-4 align-middle text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() => setSharingCandidate(candidate)}
                            title="Share 24-hour evaluation link"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 transition cursor-pointer shadow-2xs"
                          >
                            <Share2 size={11} className="text-slate-400" />
                            <span>Share</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : candidate.id)}
                            className="inline-flex items-center gap-0.5 px-2 py-1 rounded text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 transition cursor-pointer shadow-2xs"
                            title="Toggle Candidate Details"
                          >
                            <span>{isExpanded ? "Close" : "Details"}</span>
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Drill-down Detail Drawer (Rendered beneath the table when a candidate is selected) ── */}
      {expandedId && (
        <div className="bg-white border border-slate-200/90 rounded-lg p-5 shadow-xs space-y-4 animate-fadeIn">
          {(() => {
            const candidate = candidates.find((c) => c.id === expandedId);
            if (!candidate) return null;
            const exp = resolveExperienceDetails(candidate, candidate.role);
            const isExpGap = exp.status === "Under" || Boolean(candidate.short_circuited);

            return (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold tracking-tight text-slate-900">
                      Detailed Evaluation: {candidate.name}
                    </h3>
                    <span className="text-xs text-slate-500">
                      ({candidate.role || "Software Engineer"})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedId(null)}
                    className="text-xs text-slate-400 hover:text-slate-700 font-medium cursor-pointer"
                  >
                    Close Drawer ✕
                  </button>
                </div>

                {/* Experience & Requirements Verification Card */}
                <ExperienceCheckCard candidate={candidate} defaultJobTitle={candidate.role} />

                {/* GitHub Highlights Strip */}
                {candidate.github_data && (
                  <div className="flex items-center gap-4 text-xs text-slate-600 bg-slate-50/70 border border-slate-200/80 px-3 py-2 rounded-lg">
                    <span>
                      <strong className="text-slate-900 font-semibold">{candidate.github_data.public_repos ?? "N/A"}</strong> Repositories
                    </span>
                    <span className="text-slate-300">•</span>
                    <span>
                      <strong className="text-slate-900 font-semibold">{candidate.github_data.followers ?? "N/A"}</strong> Followers
                    </span>
                    {candidate.github_data.top_languages && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span>Languages: {candidate.github_data.top_languages.join(", ")}</span>
                      </>
                    )}
                  </div>
                )}

                {/* Tailored Screening Questions (Qualified Candidates Only) */}
                {!isExpGap && candidate.questions && candidate.questions.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                        <Sparkles size={12} className="text-slate-500" />
                        Tailored Technical Screening Questions
                      </span>
                      <span className="text-[11px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                        {candidate.questions.length} Pillars
                      </span>
                    </div>
                    <div className="space-y-2.5">
                      {candidate.questions.map((q, idx) => (
                        <TechQuestionCard key={idx} question={q} index={idx} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Share 24-hour evaluation modal */}
      <ShareEvalModal
        isOpen={Boolean(sharingCandidate)}
        onClose={() => setSharingCandidate(null)}
        candidate={sharingCandidate}
      />
    </div>
  );
}
