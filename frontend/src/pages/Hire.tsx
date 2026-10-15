/**
 * HireMind - Tech Candidate Screening Page
 *
 * Minimalist, production-grade candidate screening interface.
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
  Share2,
  FileText,
  AlertTriangle,
  Mail,
} from "lucide-react";
import api from "../api/client";
import ShareEvalModal from "../components/ShareEvalModal";
import ExperienceCheckCard from "../components/ExperienceCheckCard";
import TechQuestionCard from "../components/TechQuestionCard";
import { getJobOpenings, type JobOpening } from "../utils/jobStorage";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScreeningResult {
  score: number;
  reason: string;
  shortlist: boolean;
  skills_found: string[];
  github_highlights: string;
  recommendation: string;
  experience_check?: any;
  what_they_want?: string;
  what_candidate_has?: string;
  requirements_breakdown?: any[];
  short_circuited?: boolean;
  fast_fail_reason?: string;
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
  candidate: {
    name?: string;
    email?: string;
    resume_file: string;
    github_username: string | null;
  };
  screening: ScreeningResult;
  github_data: GitHubData;
  eval_id?: string;
  share_url?: string;
  email_notification?: {
    sent: boolean;
    candidate_email?: string;
    recruiter_email?: string;
    share_url?: string;
  };
  resume_text_preview: string;
}

interface Question {
  question: string;
  topic: string;
  difficulty: "Easy" | "Medium" | "Hard";
}

function scoreLabel(score: number): string {
  if (score >= 90) return "Exceptional";
  if (score >= 70) return "Strong";
  if (score >= 50) return "Partial Fit";
  return "Not a Fit";
}

function CategorizedSkills({ skills }: { skills: string[] }) {
  if (!skills || skills.length === 0) return null;

  const categories: Record<string, string[]> = {
    "Backend & Architecture": [],
    "Databases, Caching & AI": [],
    "DevOps, Cloud & Tooling": [],
    "Core Tools": [],
  };

  skills.forEach((s) => {
    const lower = s.toLowerCase();
    if (/sql|postgres|vector|mongo|redis|rag|langchain|scikit|llm|embed/i.test(lower)) {
      categories["Databases, Caching & AI"].push(s);
    } else if (/docker|aws|gcp|azure|kubernetes|ci\/cd|actions|git|linux|deploy/i.test(lower)) {
      categories["DevOps, Cloud & Tooling"].push(s);
    } else if (/python|fastapi|flask|django|node|typescript|javascript|api|rest|graphql/i.test(lower)) {
      categories["Backend & Architecture"].push(s);
    } else {
      categories["Core Tools"].push(s);
    }
  });

  return (
    <div className="space-y-3 pt-4 border-t border-slate-100">
      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
        Verified Technical Stack ({skills.length} Skills Detected)
      </span>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Object.entries(categories).map(([cat, list]) => {
          if (list.length === 0) return null;
          return (
            <div key={cat} className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-2">
              <span className="text-[11px] font-semibold text-slate-600 block">
                {cat}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {list.map((skill, i) => (
                  <span
                    key={i}
                    className="text-xs font-medium px-2 py-0.5 bg-white text-slate-800 border border-slate-200 rounded-md shadow-2xs font-mono"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Hire({ initialJob }: { initialJob?: JobOpening | null }) {
  // Job openings list
  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>(initialJob?.id || "");

  // Form state
  const [jd, setJd] = useState(initialJob?.description || "");
  const [githubUsername, setGithubUsername] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const list = getJobOpenings();
    setJobs(list);
    if (initialJob) {
      setSelectedJobId(initialJob.id);
      setJd(initialJob.description);
    } else if (list.length > 0 && !jd) {
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
  const [resendingEmail, setResendingEmail] = useState(false);
  const [emailSentMessage, setEmailSentMessage] = useState<string>("");
  const [spinUpSeconds, setSpinUpSeconds] = useState(0);

  useEffect(() => {
    let timer: any;
    if (screening) {
      setSpinUpSeconds(0);
      timer = setInterval(() => {
        setSpinUpSeconds((s) => s + 1);
      }, 1000);
    } else {
      setSpinUpSeconds(0);
    }
    return () => clearInterval(timer);
  }, [screening]);

  // Result state
  const [result, setResult] = useState<ScreenResponse | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [error, setError] = useState<string>("");
  const [sharingCandidate, setSharingCandidate] = useState<any>(null);

  // Email dispatch mode: "manual" (hold email for review) vs "auto" (send immediately on shortlist)
  const [emailDispatchMode, setEmailDispatchMode] = useState<"auto" | "manual">(() => {
    return (localStorage.getItem("hiremind_email_dispatch_mode") as "auto" | "manual") || "manual";
  });
  const [emailAlreadySent, setEmailAlreadySent] = useState<boolean>(false);

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
    setEmailSentMessage("");
    setEmailAlreadySent(false);
    setResult(null);
    setQuestions([]);
    setScreening(true);

    try {
      const activeRole = jobs.find((j) => j.id === selectedJobId)?.title || initialJob?.title || "Software Engineer";
      const formData = new FormData();
      formData.append("job_description", jd.trim());
      formData.append("resume_file", resumeFile);
      formData.append("github_username", githubUsername.trim());
      formData.append("candidate_email", candidateEmail.trim());
      formData.append("role_title", activeRole);
      formData.append("send_email", emailDispatchMode === "auto" ? "true" : "false");

      const res = await api.post<ScreenResponse>("/api/hire/screen", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setResult(res.data);

      if (res.data?.email_notification?.sent) {
        setEmailAlreadySent(true);
        const destCandidate = res.data.candidate?.email ? `candidate (${res.data.candidate.email})` : "candidate";
        setEmailSentMessage(
          `✉️ Automated shortlist email sent to ${destCandidate} & hiring team (${res.data.email_notification.recruiter_email})`
        );
      } else if (res.data?.screening?.shortlist) {
        setEmailAlreadySent(false);
        const destCandidate = res.data.candidate?.email || candidateEmail.trim();
        setEmailSentMessage(
          `ℹ️ Candidate shortlisted (Score: ${res.data.screening.score}%). Email held for recruiter review — click "Send Shortlist Email" below to notify ${destCandidate || "candidate"}.`
        );
      }

      const screeningData = res.data.screening;
      const isSevereExpGap =
        Boolean(screeningData?.short_circuited) ||
        screeningData?.experience_check?.status === "Under" ||
        (screeningData?.score !== undefined && screeningData?.score < 70);

      if (!isSevereExpGap) {
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
      } else {
        setQuestions([]);
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

  const handleSendEmail = async () => {
    if (!result || !result.screening) return;
    setResendingEmail(true);
    try {
      const activeRole = jobs.find((j) => j.id === selectedJobId)?.title || initialJob?.title || "Software Engineer";
      const targetEmail = result.candidate?.email || candidateEmail.trim();
      const shareUrl = result.share_url || `https://hiremind-ai-gules.vercel.app/eval?id=${result.eval_id}`;
      await api.post("/api/hire/send-shortlist-email", {
        candidate_name: result.candidate?.name || result.candidate.resume_file.replace(/\.pdf$/i, "").replace(/[-_]/g, " "),
        candidate_email: targetEmail,
        role_title: activeRole,
        score: result.screening.score,
        recommendation: result.screening.recommendation,
        share_url: shareUrl,
        what_candidate_has: result.screening.what_candidate_has || result.screening.reason,
      });
      setEmailAlreadySent(true);
      setEmailSentMessage(`✉️ Shortlist email delivered to ${targetEmail || "candidate"} and hiring team.`);
    } catch (e: any) {
      console.warn("Manual email send error:", e);
    } finally {
      setResendingEmail(false);
    }
  };

  const s = result?.screening;
  const gh = result?.github_data;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="px-6 py-5 max-w-7xl mx-auto space-y-3.5 font-[Inter,system-ui,sans-serif]">
      {/* ── Page header with KPI / Specs Capsule ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div>
          <h1 className="text-base font-bold tracking-tight text-slate-900 leading-tight">
            Quick Screen
          </h1>
          <p className="text-xs text-slate-500">
            Autonomous resume parsing, requirement verification &amp; question generation
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2.5 text-xs text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-lg shadow-2xs">
          <span>Engine: <strong className="text-slate-900 font-semibold">Groq LPU + FastEmbed</strong></span>
          <span className="text-slate-200">|</span>
          <span>Storage: <strong className="text-slate-900 font-semibold">PostgreSQL pgvector</strong></span>
        </div>
      </div>

      {/* ── Input form canvas ── */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-5 sm:p-6 shadow-xs space-y-5">
        {/* Row 1: Job Description with Role Dropdown */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Job Description *
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Select Role:</span>
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
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleScreen();
              }
            }}
            placeholder="e.g. Senior Full-Stack Engineer — 3+ years React/FastAPI, experience with AWS, REST APIs, SQL databases... (Press Ctrl+Enter to screen)"
            className="w-full h-28 px-3.5 py-2.5 text-xs border border-slate-200 rounded-lg resize-none focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 text-slate-900 placeholder:text-slate-400 transition"
          />
        </div>

        {/* Row 2: 3-Column Responsive Fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Resume upload */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
              Resume PDF *
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-3 px-3.5 py-2.5 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition group h-[38px]"
            >
              <Upload size={14} className="text-slate-400 group-hover:text-slate-700 shrink-0" />
              <span className="text-xs text-slate-600 group-hover:text-slate-900 truncate">
                {resumeFile ? resumeFile.name : "Upload resume (PDF)"}
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
              GitHub (optional)
            </label>
            <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg focus-within:border-slate-900 focus-within:ring-1 focus-within:ring-slate-900 transition h-[38px]">
              <Github size={14} className="text-slate-400 shrink-0" />
              <input
                value={githubUsername}
                onChange={(e) => setGithubUsername(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleScreen();
                  }
                }}
                placeholder="e.g. torvalds"
                className="flex-1 text-xs bg-transparent outline-none text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Candidate Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
              Candidate Email (optional)
            </label>
            <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg focus-within:border-slate-900 focus-within:ring-1 focus-within:ring-slate-900 transition h-[38px]">
              <Mail size={14} className="text-slate-400 shrink-0" />
              <input
                value={candidateEmail}
                onChange={(e) => setCandidateEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleScreen();
                  }
                }}
                placeholder="Auto-detected from resume if blank"
                className="flex-1 text-xs bg-transparent outline-none text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Row 3: Shortlist Notification Dispatch Mode (Auto vs Manual Approval) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3.5 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <Mail size={13} className="text-slate-500 shrink-0" />
            <span className="text-xs font-semibold text-slate-700">Shortlist Notification Dispatch:</span>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Choose whether to email shortlisted candidates automatically or review first
            </span>
          </div>

          <div className="inline-flex p-0.5 bg-slate-100 rounded-md border border-slate-200/80 text-[11px] shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => {
                setEmailDispatchMode("manual");
                localStorage.setItem("hiremind_email_dispatch_mode", "manual");
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                emailDispatchMode === "manual"
                  ? "bg-white text-slate-900 shadow-2xs font-semibold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              title="Screening generates results without emailing. You can review first and click 'Send Shortlist Email' manually."
            >
              <span className={`w-1.5 h-1.5 rounded-full ${emailDispatchMode === "manual" ? "bg-amber-500" : "bg-slate-300"}`} />
              <span>Manual Approval (Review First)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEmailDispatchMode("auto");
                localStorage.setItem("hiremind_email_dispatch_mode", "auto");
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                emailDispatchMode === "auto"
                  ? "bg-white text-slate-900 shadow-2xs font-semibold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              title="Automatically send email notification to candidate and hiring team if candidate matches score >= 70%."
            >
              <span className={`w-1.5 h-1.5 rounded-full ${emailDispatchMode === "auto" ? "bg-emerald-500" : "bg-slate-300"}`} />
              <span>Auto-Send on Shortlist</span>
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3.5 py-2.5">
            <XCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit button & Server Spin-up Notice */}
        <div className="pt-2 space-y-3">
          <div className="flex items-center gap-3">
            <button
              onClick={handleScreen}
              disabled={screening || loadingQuestions}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-black text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs active:scale-[0.99]"
            >
              {screening ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>
                    {spinUpSeconds >= 3
                      ? `Screening candidate profile (${spinUpSeconds}s)...`
                      : "Screening candidate profile..."}
                  </span>
                </>
              ) : (
                <>
                  <Star size={14} />
                  <span>Screen Candidate</span>
                </>
              )}
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono text-slate-600">Enter</kbd> to run</span>
            </div>
          </div>

          {/* Cloud Processing Progress Notice */}
          {screening && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-slate-800">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="flex items-center gap-2 text-slate-900 font-semibold">
                  <Loader2 size={13} className="animate-spin text-slate-500 shrink-0" />
                  <span>
                    {spinUpSeconds >= 3
                      ? "Cloud Backend Processing (Render Free-Tier)..."
                      : "Ingesting resume & preparing evaluation pipeline..."}
                  </span>
                </span>
                <span className="font-mono text-xs text-slate-600 bg-white border border-slate-200 px-2.5 py-0.5 rounded-md">
                  {spinUpSeconds}s / ~20s
                </span>
              </div>
              <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-slate-900 h-full transition-all duration-1000 ease-out rounded-full"
                  style={{ width: `${Math.min(95, Math.max(8, (spinUpSeconds / 20) * 100))}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {spinUpSeconds >= 3
                  ? "Cloud services spin up and evaluate LLM profiles in ~15–20 seconds. Results will appear below automatically."
                  : "Evaluating experience, verifying GitHub repositories, and matching with role requirements..."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Results ── */}
      {result && s && (
        <div className="space-y-6">
          {/* Executive Candidate Evaluation Card */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 sm:p-6 shadow-xs space-y-5">
            {/* Candidate Identity & Score Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div className="flex items-center gap-4">
                {/* Minimalist Neutral Score Card */}
                <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center shrink-0">
                  <span className="text-2xl font-bold tracking-tight text-slate-900 leading-none">{s.score}</span>
                  <span className="text-[11px] text-slate-400 font-medium mt-1">/ 100</span>
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-lg font-bold tracking-tight text-slate-900">
                      {result.candidate.resume_file.replace(/\.pdf$/i, "").replace(/[-_]/g, " ")}
                    </h2>
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-md border ${
                        s.shortlist
                          ? "bg-emerald-50/70 text-emerald-800 border-emerald-200/80"
                          : "bg-amber-50/70 text-amber-800 border-amber-200/80"
                      }`}
                    >
                      {s.shortlist ? <CheckCircle2 size={12} className="text-emerald-700" /> : <AlertTriangle size={12} className="text-amber-700" />}
                      <span>{s.recommendation} ({scoreLabel(s.score)})</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1.5 flex-wrap">
                    <span className="font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs">
                      {jobs.find((j) => j.id === selectedJobId)?.title || initialJob?.title || "Software Engineer"}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-600 flex items-center gap-1 font-mono text-xs">
                      <FileText size={12} className="text-slate-400" />
                      {result.candidate.resume_file}
                    </span>
                    {result.candidate.github_username && (
                      <>
                        <span className="text-slate-300">•</span>
                        <a
                          href={`https://github.com/${result.candidate.github_username}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-slate-700 hover:text-slate-900 font-mono transition"
                        >
                          <Github size={12} />
                          @{result.candidate.github_username}
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => {
                    const currentJobTitle =
                      jobs.find((j) => j.id === selectedJobId)?.title ||
                      initialJob?.title ||
                      "Software Engineer Candidate";
                    setSharingCandidate({
                      name: result.candidate.resume_file.replace(/\.pdf$/i, "").replace(/[-_]/g, " "),
                      role: currentJobTitle,
                      score: s.score,
                      recommendation: s.recommendation,
                      reason: s.reason,
                      skills: s.skills_found || [],
                      experience_check: s.experience_check,
                      what_they_want: s.what_they_want,
                      what_candidate_has: s.what_candidate_has,
                      requirements_breakdown: s.requirements_breakdown,
                      questions: questions,
                      github: result.candidate.github_username,
                      github_data: result.github_data,
                      appliedAt: new Date().toISOString(),
                    });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition cursor-pointer shadow-2xs"
                >
                  <Share2 size={13} className="text-slate-500" />
                  <span>Share 24h Link</span>
                </button>

                {s.shortlist && (
                  <button
                    type="button"
                    onClick={handleSendEmail}
                    disabled={resendingEmail}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shadow-xs disabled:opacity-50 ${
                      !emailAlreadySent
                        ? "bg-slate-900 hover:bg-slate-800 text-white active:scale-[0.99]"
                        : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                    title={
                      !emailAlreadySent
                        ? "Approve evaluation and send candidate shortlist notification email now"
                        : "Resend evaluation link email to candidate"
                    }
                  >
                    {resendingEmail ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Mail size={13} className={!emailAlreadySent ? "text-slate-300" : "text-slate-500"} />
                    )}
                    <span>
                      {resendingEmail
                        ? "Sending..."
                        : !emailAlreadySent
                        ? "Send Shortlist Email"
                        : "Resend Email"}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Email notification status banner */}
            {emailSentMessage && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                <span className="font-medium">{emailSentMessage}</span>
              </div>
            )}

            {/* Experience & Requirements Verification Card */}
            <ExperienceCheckCard
              candidate={{
                score: s.score,
                recommendation: s.recommendation,
                reason: s.reason,
                skills: s.skills_found || [],
                experience_check: s.experience_check,
                what_they_want: s.what_they_want,
                what_candidate_has: s.what_candidate_has,
                requirements_breakdown: s.requirements_breakdown,
                role:
                  jobs.find((j) => j.id === selectedJobId)?.title ||
                  initialJob?.title ||
                  "Software Engineer",
              }}
              defaultJobTitle={
                jobs.find((j) => j.id === selectedJobId)?.title ||
                initialJob?.title ||
                "Software Engineer"
              }
            />

            {/* Early Short-Circuit Notice */}
            {(s.short_circuited || (s.score < 65 && /internship|academic|student|gap|lacks.*senior|not a fit|limited to internship/i.test(s.reason || ""))) && (
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-slate-800">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                  <span className="font-semibold text-xs tracking-tight text-slate-900">
                    Screening Short-Circuited: Minimum Experience Threshold Not Met
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Candidate profile reflects an academic/internship background compared to the commercial experience required for this role.
                  Technical interview generation was short-circuited to conserve recruiter & engineering team bandwidth.
                </p>
                <div className="pt-1">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-md shadow-2xs">
                    Routing recommendation: Junior / Associate talent pool
                  </span>
                </div>
              </div>
            )}

            {/* Categorized Technical Skills Matrix */}
            <CategorizedSkills skills={s.skills_found || []} />
          </div>

          {/* GitHub stats */}
          {gh && !gh.error && (
            <div className="bg-white border border-slate-200/90 rounded-xl p-5 sm:p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <Github size={16} className="text-slate-700" />
                <h3 className="text-sm font-bold tracking-tight text-slate-900">
                  GitHub Activity
                </h3>
                <a
                  href={gh.profile_url}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium transition"
                >
                  View Profile <ChevronRight size={12} />
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
                    className="bg-slate-50 border border-slate-100 rounded-lg p-3.5 text-center"
                  >
                    <Icon size={14} className="mx-auto mb-1 text-slate-400" />
                    <p className="text-lg font-bold tracking-tight text-slate-900">{value}</p>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
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
                      className="text-xs font-mono px-2 py-0.5 bg-slate-50 text-slate-700 border border-slate-200/80 rounded-md"
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Screening questions: Senior Technical Interview Sheet */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <MessageSquareCode size={18} className="text-slate-800" />
                <div>
                  <h3 className="text-sm font-bold tracking-tight text-slate-900">
                    Tailored Technical Screening Questions
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Targeted questions across Core Language Mechanics, SQL/Indexing, and Distributed Systems
                  </p>
                </div>
              </div>
              {loadingQuestions ? (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <Loader2 size={13} className="animate-spin text-slate-400" />
                  <span>Synthesizing questions...</span>
                </div>
              ) : (
                <span className="text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200/60 px-2.5 py-0.5 rounded-md">
                  {questions.length} Pillars Generated
                </span>
              )}
            </div>

            {loadingQuestions && (
              <p className="text-xs text-slate-400 italic">
                Generating project-specific questions…
              </p>
            )}

            {!loadingQuestions && questions.length === 0 && (
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl text-center space-y-1">
                <span className="text-xs font-semibold text-slate-800">
                  Technical Screening Questions Bypassed
                </span>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Candidate was short-circuited due to experience mismatch. Technical question generation was skipped to save interviewer time.
                </p>
              </div>
            )}

            <div className="space-y-3">
              {questions.map((q, i) => (
                <TechQuestionCard key={i} question={q} index={i} />
              ))}
            </div>
          </div>

          {/* Log to Sheets CTA */}
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
            <ClipboardList size={15} className="text-slate-500 shrink-0" />
            <p className="text-xs text-slate-600 flex-1">
              Results can be automatically logged to Google Sheets via{" "}
              <code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-700 font-mono text-[11px]">
                POST /api/hire/log-to-sheets
              </code>{" "}
              or triggered through the n8n workflow.
            </p>
          </div>
        </div>
      )}

      <ShareEvalModal
        isOpen={Boolean(sharingCandidate)}
        onClose={() => setSharingCandidate(null)}
        candidate={sharingCandidate}
      />
    </div>
  );
}
