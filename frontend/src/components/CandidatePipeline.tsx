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
} from "lucide-react";

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
}

const INITIAL_DEMO: CandidateRecord[] = [
  {
    id: "demo-1",
    name: "Priti Jadhav",
    email: "priti@example.com",
    github: "pritijadhav",
    score: 95,
    skills: ["Python", "FastAPI", "React", "PostgreSQL", "Docker", "pgvector"],
    recommendation: "Strong Hire",
    reason: "Exceptional backend architecture experience with FastAPI, vector search, and containerization. Active open-source contributions.",
    questions: [
      { question: "How did you optimize cosine similarity search query performance with pgvector?", topic: "Database & Vector Search", difficulty: "Hard" },
      { question: "In your WebSockets implementation, how did you handle reconnection logic and backpressure?", topic: "Backend Architecture", difficulty: "Medium" },
      { question: "How do you structure dependency injection and async DB sessions in high-concurrency FastAPI apps?", topic: "API Engineering", difficulty: "Medium" }
    ],
    appliedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    github_data: { public_repos: 28, followers: 85, top_languages: ["Python", "TypeScript", "React"] }
  },
  {
    id: "demo-2",
    name: "Alex Rivera",
    email: "alex.r@example.com",
    github: "alexrivera",
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
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("hiremind_candidates");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.length > 0) {
          setCandidates(parsed);
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
      (c.skills && c.skills.some((s) => s.toLowerCase().includes(search.toLowerCase()))) ||
      (c.github && c.github.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;
    if (filter === "shortlisted") return c.score >= 70;
    if (filter === "reviewed") return c.score < 70;
    return true;
  });

  const totalCount = candidates.length;
  const shortlistedCount = candidates.filter((c) => c.score >= 70).length;
  const reviewedCount = totalCount - shortlistedCount;
  const avgScore = totalCount > 0 ? Math.round(candidates.reduce((a, b) => a + b.score, 0) / totalCount) : 0;

  const scoreBadge = (score: number) => {
    if (score >= 80) return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (score >= 60) return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 font-[Inter,system-ui,sans-serif]">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Candidate Pipeline</h1>
          <p className="text-xs text-slate-500 mt-1">
            Active candidate profiles and automated evaluations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onSwitchToScreen && (
            <button
              type="button"
              onClick={onSwitchToScreen}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-xs cursor-pointer active:scale-[0.99]"
            >
              <PlusCircle size={14} />
              <span>Quick Screen</span>
            </button>
          )}
          <a
            href="https://docs.google.com/spreadsheets/d/1RsYvMSI8Nte2OU7uzSYTjqyBidwgXbXs9uC6IIttqUg"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 transition-all shadow-xs"
          >
            <ExternalLink size={14} className="text-slate-500" />
            <span>Google Sheets</span>
          </a>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500">Total Applicants</span>
          <p className="text-2xl font-bold tracking-tight text-slate-900 mt-1">{totalCount}</p>
        </div>
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500">Shortlisted (Score ≥ 70)</span>
          <p className="text-2xl font-bold tracking-tight text-emerald-600 mt-1">{shortlistedCount}</p>
        </div>
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500">Avg Match Score</span>
          <p className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            {avgScore}<span className="text-xs font-normal text-slate-400 ml-1">/ 100</span>
          </p>
        </div>
      </div>

      {/* Search & Segmented Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-slate-200/90 p-2.5 rounded-xl shadow-xs">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter candidates or skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-400 transition"
          />
        </div>

        {/* Unified Segment Control */}
        <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/80 text-xs">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
              filter === "all"
                ? "bg-white text-slate-900 shadow-2xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("shortlisted")}
            className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
              filter === "shortlisted"
                ? "bg-white text-slate-900 shadow-2xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Shortlisted ({shortlistedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("reviewed")}
            className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
              filter === "reviewed"
                ? "bg-white text-slate-900 shadow-2xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Under Review ({reviewedCount})
          </button>
        </div>
      </div>

      {/* Candidate List Rows */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white p-10 text-center rounded-xl border border-slate-200 text-slate-400 text-xs">
            No candidates match your current filter.
          </div>
        ) : (
          filtered.map((candidate) => {
            const isExpanded = expandedId === candidate.id;
            const isShortlisted = candidate.score >= 70;
            return (
              <div
                key={candidate.id}
                className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs transition-all hover:border-slate-300"
              >
                {/* Main Summary Row */}
                <div className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* Score Pill */}
                    <div
                      className={`h-9 px-2.5 rounded-lg flex items-center justify-center font-bold text-xs border shrink-0 ${scoreBadge(
                        candidate.score
                      )}`}
                    >
                      {candidate.score}/100
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 text-[13px]">{candidate.name}</span>
                        {isShortlisted ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={11} /> Shortlisted
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            Under Review
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                        {candidate.company && (
                          <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded text-[10px]">
                            {candidate.company}
                          </span>
                        )}
                        {candidate.role && (
                          <span className="text-slate-600 font-medium">{candidate.role}</span>
                        )}
                        {candidate.github && (
                          <a
                            href={`https://github.com/${candidate.github}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-mono transition-colors"
                          >
                            <Github size={11} />
                            @{candidate.github}
                          </a>
                        )}
                        <span className="text-slate-300">•</span>
                        <span>{new Date(candidate.appliedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Skills tags & Expand Action */}
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="hidden md:flex items-center gap-1.5 flex-wrap justify-end">
                      {candidate.skills?.slice(0, 4).map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded text-[10.5px] font-medium bg-slate-50 text-slate-600 border border-slate-200/60"
                        >
                          {skill}
                        </span>
                      ))}
                      {candidate.skills?.length > 4 && (
                        <span className="text-[10px] text-slate-400">
                          +{candidate.skills.length - 4}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : candidate.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 transition cursor-pointer shrink-0"
                    >
                      <span>{isExpanded ? "Hide Details" : "View Details"}</span>
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  </div>
                </div>

                {/* Flattened Details Drawer */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/60 p-4 space-y-3.5">
                    {/* Summary */}
                    {candidate.reason && (
                      <div className="text-xs text-slate-700 leading-relaxed">
                        <span className="font-semibold text-slate-900 block mb-0.5">Evaluation Summary</span>
                        {candidate.reason}
                      </div>
                    )}

                    {/* GitHub Insights */}
                    {candidate.github_data && (
                      <div className="flex items-center gap-4 text-xs text-slate-600">
                        <span>
                          <strong className="text-slate-900 font-semibold">{candidate.github_data.public_repos ?? "N/A"}</strong> repos
                        </span>
                        <span>•</span>
                        <span>
                          <strong className="text-slate-900 font-semibold">{candidate.github_data.followers ?? "N/A"}</strong> followers
                        </span>
                        {candidate.github_data.top_languages && (
                          <>
                            <span>•</span>
                            <span>Top: {candidate.github_data.top_languages.join(", ")}</span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Interview Questions */}
                    {candidate.questions && candidate.questions.length > 0 && (
                      <div className="pt-2 border-t border-slate-200/60">
                        <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                          <Sparkles size={12} className="text-indigo-600" />
                          Generated Interview Questions
                        </span>
                        <ul className="space-y-1.5">
                          {candidate.questions.map((q, idx) => (
                            <li key={idx} className="text-xs text-slate-700 flex items-start gap-2">
                              <span className="font-mono text-slate-400 shrink-0 text-[11px]">{idx + 1}.</span>
                              <div className="flex-1">
                                <span>{q.question}</span>
                                <span className="ml-2 text-[10px] text-slate-400 font-normal">
                                  ({q.topic} • {q.difficulty})
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
