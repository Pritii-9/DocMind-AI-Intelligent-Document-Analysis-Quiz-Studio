import { useState, useEffect } from "react";
import {
  Users,
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

// Initial demo candidates so recruiter sees a rich ATS right away
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
    // Default fallback
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
  const avgScore = totalCount > 0 ? Math.round(candidates.reduce((a, b) => a + b.score, 0) / totalCount) : 0;

  const scoreBadgeColor = (score: number) => {
    if (score >= 80) return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (score >= 60) return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-rose-50 text-rose-700 border-rose-200";
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Top Banner / Metrics */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="text-indigo-600" size={20} />
            Applicant Tracking & Pipeline
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time candidate evaluation powered by Groq LLM and GitHub Intelligence.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {onSwitchToScreen && (
            <button
              onClick={onSwitchToScreen}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition cursor-pointer shadow-sm"
            >
              <PlusCircle size={14} />
              Quick Screen Resume
            </button>
          )}
          <a
            href="https://docs.google.com/spreadsheets/d/1RsYvMSI8Nte2OU7uzSYTjqyBidwgXbXs9uC6IIttqUg"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer"
          >
            <ExternalLink size={14} />
            Open Google Sheets CRM
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Applicants</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Shortlisted (Score ≥ 70)</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{shortlistedCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Average Match Score</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{avgScore} / 100</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search candidate name, skill, or GitHub..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
              filter === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Candidates
          </button>
          <button
            onClick={() => setFilter("shortlisted")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
              filter === "shortlisted"
                ? "bg-emerald-600 text-white"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            }`}
          >
            Shortlisted Only
          </button>
          <button
            onClick={() => setFilter("reviewed")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
              filter === "reviewed"
                ? "bg-rose-600 text-white"
                : "bg-rose-50 text-rose-700 hover:bg-rose-100"
            }`}
          >
            Not Shortlisted
          </button>
        </div>
      </div>

      {/* Candidate Cards Table */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400 text-xs">
            No candidates found matching your filter.
          </div>
        ) : (
          filtered.map((candidate) => {
            const isExpanded = expandedId === candidate.id;
            return (
              <div
                key={candidate.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition hover:border-slate-300"
              >
                {/* Header Row */}
                <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    {/* Score Circle Badge */}
                    <div
                      className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold text-sm border ${scoreBadgeColor(
                        candidate.score
                      )}`}
                    >
                      <span>{candidate.score}</span>
                      <span className="text-[9px] font-normal leading-none opacity-80">/100</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-sm">{candidate.name}</h3>
                        {candidate.score >= 70 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={11} /> Shortlisted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            Under Review
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                        {candidate.github && (
                          <a
                            href={`https://github.com/${candidate.github}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                          >
                            <Github size={12} />
                            @{candidate.github}
                          </a>
                        )}
                        <span>Applied {new Date(candidate.appliedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Skills Preview & Action */}
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="hidden md:flex items-center gap-1.5 flex-wrap max-w-sm justify-end">
                      {candidate.skills?.slice(0, 4).map((skill, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600"
                        >
                          {skill}
                        </span>
                      ))}
                      {candidate.skills?.length > 4 && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          +{candidate.skills.length - 4} more
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => setExpandedId(isExpanded ? null : candidate.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
                    >
                      <span>{isExpanded ? "Hide Details" : "Review Candidate"}</span>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/70 p-5 space-y-4">
                    {/* Evaluation Summary */}
                    {candidate.reason && (
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          AI Screening Assessment
                        </p>
                        <p className="text-xs text-slate-700 leading-relaxed">{candidate.reason}</p>
                      </div>
                    )}

                    {/* GitHub Insights */}
                    {candidate.github_data && (
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-wrap gap-4 text-xs">
                        <div>
                          <span className="text-slate-400 text-[11px] block">Public Repos:</span>
                          <span className="font-semibold text-slate-800">
                            {candidate.github_data.public_repos ?? "N/A"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[11px] block">Followers:</span>
                          <span className="font-semibold text-slate-800">
                            {candidate.github_data.followers ?? "N/A"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[11px] block">Top Languages:</span>
                          <span className="font-semibold text-slate-800">
                            {candidate.github_data.top_languages?.join(", ") || "None"}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Interview Questions */}
                    {candidate.questions && candidate.questions.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Sparkles size={13} className="text-indigo-600" />
                          Generated Technical Interview Questions
                        </p>
                        <div className="space-y-2">
                          {candidate.questions.map((q, idx) => (
                            <div
                              key={idx}
                              className="bg-white p-3 rounded-lg border border-slate-200 flex items-start gap-2.5 text-xs"
                            >
                              <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center shrink-0 text-[10px]">
                                {idx + 1}
                              </span>
                              <div className="flex-1">
                                <p className="text-slate-800 font-medium">{q.question}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] text-slate-400 font-medium">{q.topic}</span>
                                  <span
                                    className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                                      q.difficulty === "Hard"
                                        ? "bg-rose-50 text-rose-600"
                                        : q.difficulty === "Medium"
                                        ? "bg-amber-50 text-amber-600"
                                        : "bg-emerald-50 text-emerald-600"
                                    }`}
                                  >
                                    {q.difficulty}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
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
