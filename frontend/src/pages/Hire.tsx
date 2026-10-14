/**
 * HireMind - Tech Candidate Screening Page
 *
 * Provides a single-page interface for startup hiring teams to:
 * 1. Input a job description
 * 2. Upload a candidate's resume (PDF)
 * 3. Optionally enter a GitHub username
 * 4. Trigger AI screening via /api/hire/screen
 * 5. View score card, reason, GitHub stats, and generated screening questions
 */
import { useState, useRef, useEffect } from "react";
import {
  Github,
  Upload,
  Star,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  ChevronDown,
  Code2,
  MessageSquareCode,
  GitFork,
  Trophy,
  ClipboardList,
} from "lucide-react";
import api from "../api/client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScreeningResult {
  score: number;
  reason: string;
  shortlist: boolean;
  skills_found: string[];
  github_highlights: string;
  recommendation: string;
}

interface GitHubData {
  username: string;
  public_repos: number;
  followers: number;
  top_languages: string[];
  last_updated: string;
  profile_url: string;
  error?: string;
}

interface ScreenResponse {
  status: string;
  candidate: { resume_file: string; github_username: string | null };
  screening: ScreeningResult;
  github_data: GitHubData;
  resume_text_preview: string;
}

interface Question {
  question: string;
  topic: string;
  difficulty: "Easy" | "Medium" | "Hard";
}

// ── Score colour helper ────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return "#22c55e"; // green-500
  if (score >= 60) return "#f59e0b"; // amber-500
  return "#ef4444"; // red-500
}

function scoreLabel(score: number): string {
  if (score >= 90) return "Exceptional";
  if (score >= 70) return "Strong";
  if (score >= 50) return "Partial Fit";
  return "Not a Fit";
}

function difficultyBadge(difficulty: string) {
  const map: Record<string, string> = {
    Easy: "bg-green-100 text-green-700",
    Medium: "bg-amber-100 text-amber-700",
    Hard: "bg-red-100 text-red-700",
  };
  return map[difficulty] || "bg-slate-100 text-slate-600";
}

import { getJobOpenings, type JobOpening } from "../utils/jobStorage";

// ── Component ─────────────────────────────────────────────────────────────────

export default function Hire({ initialJob }: { initialJob?: JobOpening | null }) {
  // Job openings list
  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>(initialJob?.id || "");

  // Form state
  const [jd, setJd] = useState(initialJob?.description || "");
  const [githubUsername, setGithubUsername] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const list = getJobOpenings();
    setJobs(list);
    if (initialJob) {
      setSelectedJobId(initialJob.id);
      setJd(initialJob.description);
    } else if (list.length > 0 && !jd) {
      // Default to first open job
      setSelectedJobId(list[0].id);
      setJd(list[0].description);
    }
  }, [initialJob]);

  const handleSelectJob = (jobId: string) => {
    setSelectedJobId(jobId);
    const found = jobs.find((j) => j.id === jobId);
    if (found) {
      setJd(found.description);
    }
  };

  // Loading states
  const [screening, setScreening] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Result state
  const [result, setResult] = useState<ScreenResponse | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [error, setError] = useState<string>("");

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && f.type === "application/pdf") {
      setResumeFile(f);
      setError("");
    } else if (f) {
      setError("Please select a PDF file.");
    }
  };

  const handleScreen = async () => {
    if (!jd.trim()) return setError("Please enter a job description.");
    if (!resumeFile) return setError("Please upload a resume PDF.");
    setError("");
    setResult(null);
    setQuestions([]);
    setScreening(true);

    try {
      const formData = new FormData();
      formData.append("job_description", jd.trim());
      formData.append("resume_file", resumeFile);
      formData.append("github_username", githubUsername.trim());

      const res = await api.post<ScreenResponse>("/api/hire/screen", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setResult(res.data);

      // Auto-generate questions after successful screen
      setLoadingQuestions(true);
      try {
        const qRes = await api.post<{ questions: Question[] }>(
          "/api/hire/generate-questions",
          {
            resume_text: res.data.resume_text_preview,
            jd: jd.trim(),
          }
        );
        setQuestions(qRes.data.questions || []);
      } catch (qErr: any) {
        console.warn("[HireMind] Question generation failed:", qErr?.message);
      } finally {
        setLoadingQuestions(false);
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Screening failed. Check console.";
      setError(msg);
    } finally {
      setScreening(false);
    }
  };

  const s = result?.screening;
  const gh = result?.github_data;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-8 py-8 space-y-6 font-[Inter,system-ui,sans-serif]">
      {/* ── Page header ── */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Quick Screen</h1>
        <p className="text-xs text-slate-500 mt-1">
          On-Demand Candidate Evaluation
        </p>
      </div>

      {/* ── Input form canvas ── */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-5">
        {/* Row 1: Job Description with Role Dropdown */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Job Description *
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-medium">Select Open Role:</span>
              <div className="relative inline-flex items-center">
                <select
                  value={selectedJobId}
                  onChange={(e) => handleSelectJob(e.target.value)}
                  className="h-8 pl-3 pr-8 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-lg appearance-none focus:outline-none focus:border-slate-400 transition cursor-pointer"
                >
                  <option value="">-- Custom Job Description --</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title} ({j.experience})
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={13}
                  className="absolute right-2.5 text-slate-400 pointer-events-none"
                />
              </div>
            </div>
          </div>
          <textarea
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            placeholder="e.g. Senior Full-Stack Engineer — 3+ years React/FastAPI, experience with AWS, REST APIs, SQL databases..."
            className="w-full h-28 px-3.5 py-2.5 text-xs border border-slate-200 rounded-lg resize-none focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 text-slate-900 placeholder:text-slate-400 transition"
          />
        </div>

        {/* Row 2: Side-by-Side Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Resume upload */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
              Resume PDF *
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-3 px-3.5 py-2.5 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition group"
            >
              <Upload size={15} className="text-slate-400 group-hover:text-slate-700" />
              <span className="text-xs text-slate-600 group-hover:text-slate-900 truncate">
                {resumeFile ? resumeFile.name : "Click to upload candidate resume (PDF)"}
              </span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* GitHub username */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
              GitHub Username (optional)
            </label>
            <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg focus-within:border-slate-900 focus-within:ring-1 focus-within:ring-slate-900 transition">
              <Github size={14} className="text-slate-400 shrink-0" />
              <input
                value={githubUsername}
                onChange={(e) => setGithubUsername(e.target.value)}
                placeholder="e.g. torvalds"
                className="flex-1 text-xs bg-transparent outline-none text-slate-900 placeholder:text-slate-400"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Fetches repositories, languages, and commit history.
            </p>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            <XCircle size={14} />
            {error}
          </div>
        )}

        {/* Submit button */}
        <div className="pt-2">
          <button
            onClick={handleScreen}
            disabled={screening || loadingQuestions}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-black text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs active:scale-[0.99]"
          >
            {screening ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Screening candidate profile...</span>
              </>
            ) : (
              <>
                <Star size={14} />
                <span>Screen Candidate</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Results ── */}
      {result && s && (
        <div className="space-y-5">
          {/* Score card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              {/* Score circle + recommendation */}
              <div className="flex items-center gap-5">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center font-extrabold text-2xl text-white shrink-0 shadow-md"
                  style={{ background: scoreColor(s.score) }}
                >
                  {s.score}
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900">
                    {scoreLabel(s.score)}
                  </p>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full mt-1 ${
                      s.shortlist
                        ? "bg-green-100 text-green-700"
                        : "bg-red-50 text-red-600"
                    }`}
                  >
                    {s.shortlist ? (
                      <CheckCircle2 size={12} />
                    ) : (
                      <XCircle size={12} />
                    )}
                    {s.recommendation}
                  </span>
                </div>
              </div>

              {/* File info */}
              <div className="text-right text-xs text-slate-400">
                <p className="font-medium text-slate-600">
                  {result.candidate.resume_file}
                </p>
                {result.candidate.github_username && (
                  <a
                    href={`https://github.com/${result.candidate.github_username}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 justify-end mt-1 hover:text-[var(--brand)] transition"
                  >
                    <Github size={11} />
                    {result.candidate.github_username}
                  </a>
                )}
              </div>
            </div>

            {/* Reason */}
            <p className="mt-4 text-sm text-slate-700 leading-relaxed border-t border-slate-100 pt-4">
              {s.reason}
            </p>

            {/* GitHub highlights */}
            {s.github_highlights && (
              <p className="mt-2 text-xs text-slate-500 italic">
                🐙 {s.github_highlights}
              </p>
            )}

            {/* Skills found */}
            {s.skills_found.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Skills Found
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {s.skills_found.map((skill, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 bg-[var(--brand-light)] text-[var(--brand)] rounded-full font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* GitHub stats */}
          {gh && !gh.error && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Github size={16} className="text-slate-700" />
                <h3 className="text-sm font-bold text-slate-800">
                  GitHub Activity
                </h3>
                <a
                  href={gh.profile_url}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto text-xs text-[var(--brand)] hover:underline flex items-center gap-1"
                >
                  View Profile <ChevronRight size={11} />
                </a>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {[
                  { label: "Public Repos", value: gh.public_repos, icon: GitFork },
                  { label: "Followers", value: gh.followers, icon: Trophy },
                  {
                    label: "Top Language",
                    value: gh.top_languages?.[0] || "N/A",
                    icon: Code2,
                  },
                  {
                    label: "Last Active",
                    value: gh.last_updated
                      ? new Date(gh.last_updated).toLocaleDateString()
                      : "N/A",
                    icon: CheckCircle2,
                  },
                ].map(({ label, value, icon: Icon }) => (
                  <div
                    key={label}
                    className="bg-slate-50 rounded-lg p-3 text-center"
                  >
                    <Icon size={14} className="mx-auto mb-1 text-slate-400" />
                    <p className="text-lg font-bold text-slate-900">{value}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
              {gh.top_languages?.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {gh.top_languages.map((lang, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full"
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Screening questions */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquareCode size={16} className="text-slate-700" />
              <h3 className="text-sm font-bold text-slate-800">
                Technical Screening Questions
              </h3>
              {loadingQuestions && (
                <Loader2 size={13} className="animate-spin text-slate-400 ml-1" />
              )}
            </div>

            {loadingQuestions && (
              <p className="text-xs text-slate-400 italic">
                Generating project-specific questions…
              </p>
            )}

            {!loadingQuestions && questions.length === 0 && (
              <p className="text-xs text-slate-400 italic">
                No questions generated yet.
              </p>
            )}

            <div className="space-y-3">
              {questions.map((q, i) => (
                <div
                  key={i}
                  className="flex gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100"
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--brand)] text-white text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 leading-snug">{q.question}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] font-medium text-slate-500">
                        {q.topic}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-px rounded ${difficultyBadge(
                          q.difficulty
                        )}`}
                      >
                        {q.difficulty}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Log to Sheets CTA */}
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
            <ClipboardList size={15} className="text-slate-500 shrink-0" />
            <p className="text-xs text-slate-600 flex-1">
              Results can be automatically logged to Google Sheets via{" "}
              <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">
                POST /api/hire/log-to-sheets
              </code>{" "}
              or triggered through the n8n workflow.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
