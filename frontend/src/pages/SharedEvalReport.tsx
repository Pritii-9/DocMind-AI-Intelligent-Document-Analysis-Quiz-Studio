import { useState, useEffect } from "react";
import {
  Clock,
  AlertTriangle,
  Github,
  Mail,
  Copy,
  Check,
  Building2,
  Code2,
  Database,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import api from "../api/client";
import { decodeClientEvalToken } from "../utils/shareEval";

interface QuestionItem {
  category?: string;
  topic?: string;
  question: string;
  difficulty?: string;
  evaluation_criteria?: string;
}

interface CandidateEvalData {
  name: string;
  role?: string;
  company?: string;
  email?: string;
  github?: string;
  score: number;
  skills?: string[];
  recommendation?: string;
  reason?: string;
  questions?: QuestionItem[];
  github_data?: any;
  appliedAt?: string;
}

export default function SharedEvalReport() {
  const [candidate, setCandidate] = useState<CandidateEvalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(1800); // 30 min default
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [copied, setCopied] = useState(false);
  const [openQuestionIndex, setOpenQuestionIndex] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const evalId = params.get("id");
    const token = params.get("token");

    const loadEval = async () => {
      // 1. Check token first if present
      if (token) {
        const decoded = decodeClientEvalToken(token);
        if (decoded) {
          if (decoded.expired) {
            setExpired(true);
            setLoading(false);
            return;
          }
          setCandidate(decoded.candidate);
          setSecondsRemaining(decoded.secondsRemaining);
          setDurationMinutes(decoded.durationMinutes);
          setLoading(false);
          return;
        }
      }

      // 2. Try server ID lookup
      if (evalId) {
        try {
          const res = await api.get(`/api/hire/shared-eval/${evalId}`);
          if (res.data?.expired) {
            setExpired(true);
            setLoading(false);
            return;
          }
          if (res.data?.candidate) {
            setCandidate(res.data.candidate);
            setSecondsRemaining(res.data.seconds_remaining || 1800);
            setDurationMinutes(res.data.duration_minutes || 30);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn("Server eval fetch error:", e);
        }
      }

      // 3. Fallback demo candidate from localStorage if opened in development
      try {
        const stored = localStorage.getItem("hiremind_candidates");
        if (stored) {
          const list = JSON.parse(stored);
          if (list.length > 0) {
            setCandidate(list[0]);
            setSecondsRemaining(1800);
            setLoading(false);
            return;
          }
        }
      } catch (err) {}

      // If nothing found
      setExpired(true);
      setLoading(false);
    };

    loadEval();
  }, []);

  // Countdown timer tick
  useEffect(() => {
    if (expired || secondsRemaining <= 0) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          setExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [expired, secondsRemaining]);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s < 10 ? "0" : ""}${s}s`;
  };

  const handleCopySummary = () => {
    if (!candidate) return;
    const text = `Candidate Evaluation: ${candidate.name}
Role: ${candidate.role || "Software Engineer"}
Score: ${candidate.score}/100 (${candidate.recommendation || "Recommended"})
Skills: ${(candidate.skills || []).join(", ")}
Rationale: ${candidate.reason || "N/A"}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scoreBadge = (score: number) => {
    if (score >= 80) return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (score >= 60) return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  const categoryIcon = (cat?: string) => {
    const lower = (cat || "").toLowerCase();
    if (lower.includes("sql") || lower.includes("database")) {
      return <Database size={15} className="text-amber-600" />;
    }
    if (lower.includes("system") || lower.includes("design") || lower.includes("architecture")) {
      return <Layers size={15} className="text-indigo-600" />;
    }
    return <Code2 size={15} className="text-emerald-600" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-[Inter,system-ui,sans-serif]">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 rounded-full border-2 border-slate-900 border-t-transparent animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Loading candidate evaluation report...</p>
        </div>
      </div>
    );
  }

  if (expired || !candidate) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-[Inter,system-ui,sans-serif]">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-8 max-w-md w-full text-center shadow-xs space-y-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <Clock size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Evaluation Link Expired</h1>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              This technical candidate evaluation was configured to auto-expire after {durationMinutes} minutes for privacy and security.
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
            Please contact the hiring manager or recruiter to request a fresh evaluation link.
          </div>
        </div>
      </div>
    );
  }

  // Ensure default structured questions if none present
  const defaultQuestions: QuestionItem[] = [
    {
      category: "Core Language Fundamentals",
      topic: "Python List Comprehensions & Generator Memory Efficiency",
      question:
        "When processing large datasets in Python, under what conditions would you choose a generator expression over a list comprehension, and how does memory allocation differ under the hood?",
      difficulty: "Medium",
      evaluation_criteria:
        "Candidate should explain lazy evaluation (iterator protocol), zero immediate memory overhead, and when list indexing or multiple iterations would require an actual list.",
    },
    {
      category: "Database & SQL Optimization",
      topic: "SQL Query Execution & Composite Indexing",
      question:
        "How do you analyze slow queries using EXPLAIN ANALYZE in PostgreSQL, and what are the tradeoffs of adding composite indexes on multi-column filter queries?",
      difficulty: "Medium",
      evaluation_criteria:
        "Candidate should mention seq scan vs index scan, index ordering (leftmost prefix rule), write amplification, and buffer cache utilization.",
    },
    {
      category: "System Design & Architecture",
      topic: "Distributed Caching & High-Concurrency Throughput",
      question:
        "How would you architect a distributed caching layer (e.g. with Redis) for an API handling 10,000 requests/second to prevent cache stampedes and handle cache invalidation cleanly?",
      difficulty: "Hard",
      evaluation_criteria:
        "Candidate should discuss Cache-Aside vs Write-Through, mutual exclusion locks for stampede protection, TTL jittering, and consistency tradeoffs.",
    },
  ];

  const questions =
    candidate.questions && candidate.questions.length > 0
      ? candidate.questions
      : defaultQuestions;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-[Inter,system-ui,sans-serif]">
      {/* Top Bar with Live Expiration Countdown */}
      <header className="h-14 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-6 flex items-center justify-between sticky top-0 z-20 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-xs">
            {candidate.company ? candidate.company.slice(0, 2).toUpperCase() : "HM"}
          </div>
          <div>
            <h1 className="font-bold text-sm text-slate-900 leading-tight">
              {candidate.company || "HireMind"} Candidate Screening Report
            </h1>
            <p className="text-[11px] text-slate-500">Autonomous Interview Intelligence</p>
          </div>
        </div>

        {/* Live Countdown Badge */}
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
            <Clock size={13} className="text-amber-600 animate-pulse" />
            <span>Expires in: {formatCountdown(secondsRemaining)}</span>
          </div>
          <button
            type="button"
            onClick={handleCopySummary}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-medium text-slate-700 transition cursor-pointer"
          >
            {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            <span>{copied ? "Copied" : "Copy Summary"}</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl w-full mx-auto p-6 md:p-8 space-y-6 flex-1">
        {/* Candidate Profile Header Card */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={`w-14 h-14 rounded-xl flex items-center justify-center font-extrabold text-base border shrink-0 ${scoreBadge(
                  candidate.score
                )}`}
              >
                {candidate.score}/100
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-bold text-slate-900">{candidate.name}</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {candidate.recommendation || "Recommended"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                  <span className="font-medium text-slate-700 flex items-center gap-1">
                    <Building2 size={13} /> {candidate.role || "Software Engineer"}
                  </span>
                  {candidate.email && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="flex items-center gap-1">
                        <Mail size={12} /> {candidate.email}
                      </span>
                    </>
                  )}
                  {candidate.github && (
                    <>
                      <span className="text-slate-300">•</span>
                      <a
                        href={`https://github.com/${candidate.github}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-slate-700 hover:text-slate-900 font-mono"
                      >
                        <Github size={12} /> @{candidate.github}
                      </a>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="text-left sm:text-right text-xs text-slate-400">
              <p>Evaluation Window: {durationMinutes} min</p>
              <p className="mt-0.5 text-slate-500 font-medium">Link Protected &amp; Expiring</p>
            </div>
          </div>

          {/* AI Screening Assessment Rationale */}
          {candidate.reason && (
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                AI Screening Evaluation
              </p>
              <p className="text-xs text-slate-700 leading-relaxed">{candidate.reason}</p>
            </div>
          )}

          {/* Verified Technical Skills */}
          {candidate.skills && candidate.skills.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Verified Technical Skills
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {candidate.skills.map((skill) => (
                  <span
                    key={skill}
                    className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200/80"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tailored Technical Screening Questions Card */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Tailored Technical Screening Questions
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Targeted questions generated from the candidate's resume, covering Language Fundamentals, SQL, and System Design.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              3 Questions
            </span>
          </div>

          {/* Questions Accordion / List */}
          <div className="space-y-3">
            {questions.map((q, idx) => {
              const isOpen = openQuestionIndex === idx;
              return (
                <div
                  key={idx}
                  className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <div className="mt-0.5 shrink-0">{categoryIcon(q.category || q.topic)}</div>
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            {q.category || "Technical Competency"}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-[11px] font-medium text-slate-600">
                            {q.topic || "Core Knowledge"}
                          </span>
                          {q.difficulty && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-white border border-slate-200 text-slate-700">
                              {q.difficulty}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-slate-900 leading-snug">
                          {q.question}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setOpenQuestionIndex(isOpen ? null : idx)}
                      className="text-xs text-slate-500 hover:text-slate-900 font-medium inline-flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <span>Criteria</span>
                      {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  </div>

                  {/* Expandable Evaluation Criteria Hint */}
                  {isOpen && (
                    <div className="mt-3 pt-3 border-t border-slate-200 text-xs bg-white p-3 rounded-lg border border-slate-200/80">
                      <p className="font-semibold text-slate-700 mb-1 flex items-center gap-1">
                        <AlertTriangle size={12} className="text-amber-500" />
                        <span>What to Look for in Candidate's Response:</span>
                      </p>
                      <p className="text-slate-600 leading-relaxed text-[11px]">
                        {q.evaluation_criteria ||
                          "Look for precise technical terminology, awareness of memory and performance tradeoffs, and architectural decision rationale."}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* GitHub Intelligence Block (if available) */}
        {candidate.github_data && candidate.github_data.top_languages && (
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Github size={14} /> GitHub Repository Activity
              </h4>
              <span className="text-[11px] text-slate-400">
                {candidate.github_data.public_repos || 0} Public Repositories
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600">
              <span className="font-medium text-slate-800">Primary Languages:</span>
              {(candidate.github_data.top_languages || []).map((lang: string) => (
                <span
                  key={lang}
                  className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]"
                >
                  {lang}
                </span>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-5 border-t border-slate-200/80 text-xs text-slate-400">
        Confidential Candidate Screening Report • Generated by HireMind AI • Auto-expires in {durationMinutes} min
      </footer>
    </div>
  );
}
