import { useState, useRef, useEffect } from "react";
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Github,
  FileText,
  Send,
  Building2,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import api from "../api/client";
import { getJobOpenings, type JobOpening } from "../utils/jobStorage";
import { useCompany } from "../context/CompanyContext";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
const GITHUB_USERNAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

export default function CandidateApply() {
  const { branding } = useCompany();
  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [urlCompanyName, setUrlCompanyName] = useState<string | null>(null);

  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [spinUpSeconds, setSpinUpSeconds] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let timer: any;
    if (submitting) {
      setSpinUpSeconds(0);
      timer = setInterval(() => {
        setSpinUpSeconds((s) => s + 1);
      }, 1000);
    } else {
      setSpinUpSeconds(0);
    }
    return () => clearInterval(timer);
  }, [submitting]);

  useEffect(() => {
    const list = getJobOpenings().filter((j) => j.status === "active");
    setJobs(list);

    try {
      const params = new URLSearchParams(window.location.search);
      const qCompany = params.get("company");
      if (qCompany && qCompany.trim()) {
        setUrlCompanyName(qCompany.trim());
      }

      const queryRole = params.get("role");
      if (queryRole && list.some((j) => j.id === queryRole)) {
        setSelectedJobId(queryRole);
        return;
      }
    } catch (e) {
      // ignore
    }

    if (list.length > 0) {
      setSelectedJobId(list[0].id);
    }
  }, []);

  const effectiveCompanyName = urlCompanyName || branding.name || "HireMind AI";
  const activeJob = jobs.find((j) => j.id === selectedJobId) || jobs[0];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setErrorMsg("Please upload a PDF resume (.pdf).");
        return;
      }
      setResumeFile(file);
      setErrorMsg("");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setErrorMsg("Please upload a PDF resume (.pdf).");
        return;
      }
      setResumeFile(file);
      setErrorMsg("");
    }
  };

  const cleanGithubUsername = (url: string) => {
    return url
      .trim()
      .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
      .replace(/^@/, "")
      .replace(/\/+$/, "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ── Strict Validation Rules ──
    const trimmedName = candidateName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setErrorMsg("Please enter your full legal name (at least 2 characters).");
      return;
    }
    if (!/[a-zA-Z]/.test(trimmedName)) {
      setErrorMsg("Name must contain letters.");
      return;
    }

    const trimmedEmail = candidateEmail.trim().toLowerCase();
    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
      setErrorMsg("Please enter a valid email address (e.g., candidate@domain.com).");
      return;
    }

    if (!resumeFile) {
      setErrorMsg("Please upload your resume in PDF format.");
      return;
    }
    if (!resumeFile.name.toLowerCase().endsWith(".pdf")) {
      setErrorMsg("Resume file must be a valid PDF document (.pdf).");
      return;
    }
    if (resumeFile.size < 5 * 1024) {
      setErrorMsg("Uploaded resume is under 5KB and appears corrupted or empty.");
      return;
    }
    if (resumeFile.size > 10 * 1024 * 1024) {
      setErrorMsg("Resume PDF exceeds the 10MB maximum file size limit.");
      return;
    }

    const ghUser = cleanGithubUsername(githubUrl);
    if (ghUser && !GITHUB_USERNAME_REGEX.test(ghUser)) {
      setErrorMsg("Invalid GitHub username format. Please enter your valid GitHub username.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      const targetJd = activeJob?.description || "Software Engineer role";
      const formData = new FormData();
      formData.append("job_description", targetJd);
      formData.append("github_username", ghUser);
      formData.append("resume_file", resumeFile);
      formData.append("candidate_name", trimmedName);
      formData.append("candidate_email", trimmedEmail);
      formData.append("role_title", activeJob?.title || "Software Engineer");
      formData.append("send_email", "true");

      // 1. Screen candidate via AI pipeline
      const screenRes = await api.post("/api/hire/screen", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = screenRes.data;

      // 2. Senior Dev Fast-Fail: Only skip questions if score < 70 or explicit experience gap status
      const s = data.screening;
      const isSevereExpGap =
        Boolean(s?.short_circuited) ||
        s?.experience_check?.status === "Under" ||
        (s?.score !== undefined && s?.score < 70);

      let questions: any[] = [];
      if (!isSevereExpGap) {
        try {
          const qRes = await api.post("/api/hire/generate-questions", {
            resume_text: data.resume_text_preview || "Technical candidate resume",
            jd: targetJd,
          });
          questions = qRes.data.questions || [];
        } catch (err) {
          console.warn("Questions generation skipped:", err);
        }
      } else {
        console.info("[HireMind Fast-Fail] Technical question generation bypassed due to experience gap.");
      }

      // 3. Log to Google Sheet with Company and Role tagging
      try {
        await api.post("/api/hire/log-to-sheets", {
          name: `[${effectiveCompanyName}] ${trimmedName} [${activeJob?.title || "Candidate"}]`,
          score: data.screening?.score || 70,
          github_data: data.github_data || {},
          questions: questions,
        });
      } catch (err) {
        console.warn("Sheets logging:", err);
      }

      // 4. Store in local applicant list for recruiter pipeline tagged by company
      try {
        const existing = JSON.parse(localStorage.getItem("hiremind_candidates") || "[]");
        const newRecord = {
          id: Date.now().toString(),
          company: effectiveCompanyName,
          name: trimmedName,
          role: activeJob?.title || "Software Engineer",
          email: trimmedEmail,
          github: ghUser,
          score: data.screening?.score || 70,
          skills: data.screening?.skills_found || [],
          recommendation: data.screening?.recommendation || "Under Review",
          reason: data.screening?.reason || "",
          experience_check: data.screening?.experience_check,
          what_they_want: data.screening?.what_they_want,
          what_candidate_has: data.screening?.what_candidate_has,
          requirements_breakdown: data.screening?.requirements_breakdown,
          short_circuited: data.screening?.short_circuited,
          fast_fail_reason: data.screening?.fast_fail_reason,
          questions: questions,
          appliedAt: new Date().toISOString(),
          github_data: data.github_data,
        };
        localStorage.setItem("hiremind_candidates", JSON.stringify([newRecord, ...existing]));
      } catch (err) {
        console.warn("Local storage write skipped:", err);
      }

      setSubmitted(true);
    } catch (err: any) {
      console.error(err);
      const isColdStart = err?.code === "ERR_NETWORK" || err?.message?.includes("Network Error");
      setErrorMsg(
        isColdStart
          ? "Cloud AI engine waking up from sleep. Please wait 15 seconds and click Submit again!"
          : (err?.response?.data?.detail || "Failed to submit application. Please verify your details.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-[Inter,system-ui,sans-serif]">
      {/* Top Header */}
      <header className="h-14 border-b border-slate-200/80 bg-white/95 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-xs overflow-hidden shrink-0">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={effectiveCompanyName} className="w-full h-full object-contain p-0.5" />
            ) : (
              effectiveCompanyName.slice(0, 2).toUpperCase() || "HM"
            )}
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-slate-900 text-sm tracking-tight truncate">
              {effectiveCompanyName}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 leading-none">
              Careers
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Accepting Applications
          </span>
          <a
            href="/"
            className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors hidden sm:inline-flex items-center gap-1"
          >
            <span>Recruiter portal</span>
            <ArrowRight size={12} />
          </a>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-2xl w-full mx-auto px-4 py-8 space-y-5 flex-1">
        {submitted ? (
          /* Confirmation Success Card */
          <div className="bg-white rounded-xl border border-slate-200/90 p-8 text-center shadow-xs">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3.5 shadow-2xs">
              <CheckCircle2 size={24} />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1.5">Application Submitted</h2>
            <p className="text-xs text-slate-600 max-w-md mx-auto mb-6 leading-relaxed">
              Thank you, <strong>{candidateName}</strong>. Your profile and technical credentials have been successfully delivered to <strong>{effectiveCompanyName}</strong> for the <strong>{activeJob?.title || "selected"}</strong> role.
            </p>
            <button
              type="button"
              onClick={() => {
                setSubmitted(false);
                setCandidateName("");
                setCandidateEmail("");
                setGithubUrl("");
                setResumeFile(null);
              }}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs cursor-pointer"
            >
              Submit Another Application
            </button>
          </div>
        ) : (
          <>
            {/* Position Information Card */}
            <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <Building2 size={13} className="text-slate-400" />
                  <span>{effectiveCompanyName} • Active Opening</span>
                </div>

                {jobs.length > 1 && (
                  <div className="relative inline-flex items-center">
                    <select
                      value={selectedJobId}
                      onChange={(e) => setSelectedJobId(e.target.value)}
                      className="h-7 pl-2.5 pr-6 text-xs bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-md appearance-none font-medium focus:outline-none focus:border-slate-900 transition cursor-pointer"
                    >
                      {jobs.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.title}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={11} className="absolute right-2 text-slate-400 pointer-events-none" />
                  </div>
                )}
              </div>

              <div>
                <h1 className="text-lg font-bold tracking-tight text-slate-900">
                  {activeJob?.title || "Software Engineer"}
                </h1>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                  <span className="font-medium text-slate-700">{activeJob?.department || "Engineering"}</span>
                  <span className="text-slate-300">•</span>
                  <span>{activeJob?.experience || "Full-time"}</span>
                  <span className="text-slate-300">•</span>
                  <span>Remote / Hybrid</span>
                </div>
              </div>

              {activeJob?.skills && activeJob.skills.length > 0 && (
                <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                  {activeJob.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200/60"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Application Submission Form Card */}
            <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-xs">
              <div className="mb-5 pb-3 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-900">Candidate Information</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete the fields below to submit your profile for automated evaluation.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMsg && (
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Name & Email Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={candidateName}
                      onChange={(e) => setCandidateName(e.target.value)}
                      placeholder="e.g. Alex Morgan"
                      className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Work Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={candidateEmail}
                      onChange={(e) => setCandidateEmail(e.target.value)}
                      placeholder="e.g. alex@example.com"
                      className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors bg-white"
                    />
                  </div>
                </div>

                {/* GitHub Profile Field */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    GitHub Handle or Profile URL (Optional)
                  </label>
                  <div className="relative flex items-center">
                    <Github size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      placeholder="github.com/username or @username"
                      className="w-full h-9 border border-slate-200 rounded-lg pl-8.5 pr-3 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors bg-white font-mono text-xs"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    AI screening analyzes repo architecture, commit velocity, and language proficiency.
                  </p>
                </div>

                {/* PDF Resume Dropzone */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Resume / CV (PDF format) <span className="text-red-500">*</span>
                  </label>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border border-dashed rounded-lg p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                      isDragging
                        ? "border-slate-900 bg-slate-100"
                        : resumeFile
                        ? "border-emerald-300 bg-emerald-50/40"
                        : "border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    {resumeFile ? (
                      <div className="flex items-center gap-2 text-emerald-800 font-medium text-xs">
                        <FileText size={16} className="text-emerald-600" />
                        <span className="font-semibold">{resumeFile.name}</span>
                        <span className="text-emerald-600 font-normal">({(resumeFile.size / 1024).toFixed(0)} KB)</span>
                        <span className="text-slate-400 ml-1 text-[11px] underline">Change file</span>
                      </div>
                    ) : (
                      <>
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                          <Upload size={14} />
                        </div>
                        <p className="text-xs text-slate-700 font-medium">
                          Click to upload resume <span className="text-slate-400 font-normal">or drag &amp; drop</span>
                        </p>
                        <p className="text-[10px] text-slate-400">PDF documents up to 10MB</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Submit Action Button & Spin-up Progress */}
                <div className="pt-2 space-y-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-10 bg-slate-900 hover:bg-slate-800 active:bg-black text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>
                          {spinUpSeconds >= 3
                            ? `Evaluating with AI (${spinUpSeconds}s)...`
                            : "Evaluating technical profile with AI..."}
                        </span>
                      </>
                    ) : (
                      <>
                        <Send size={13} />
                        <span>Submit Application</span>
                      </>
                    )}
                  </button>
                  <p className="text-[11px] text-slate-500 text-center font-medium">
                    Render Cloud: Live automated screening completes in ~15–20 seconds
                  </p>

                  {/* Cloud AI Engine Spin-Up Progress Notice */}
                  {submitting && (
                    <div className="p-3.5 bg-amber-50/90 border border-amber-200/90 rounded-xl space-y-2 text-amber-900 animate-fadeIn">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="flex items-center gap-2">
                          <Loader2 size={13} className="animate-spin text-amber-600 shrink-0" />
                          <span>
                            {spinUpSeconds >= 3
                              ? "Cloud AI Engine Evaluating (Render Free-Tier)..."
                              : "Ingesting resume & preparing evaluation pipeline..."}
                          </span>
                        </span>
                        <span className="font-mono text-[11px] text-amber-800 bg-white border border-amber-200 px-2 py-0.5 rounded-md">
                          {spinUpSeconds}s / ~20s
                        </span>
                      </div>
                      <div className="w-full bg-amber-200/60 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-amber-600 h-full transition-all duration-1000 ease-out rounded-full"
                          style={{ width: `${Math.min(95, Math.max(8, (spinUpSeconds / 20) * 100))}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        {spinUpSeconds >= 3
                          ? "Render cloud instances process resume evaluation live in ~15–20 seconds. Please hold on — your application is finalizing."
                          : "Extracting skills, validating GitHub repositories, and matching with role requirements..."}
                      </p>
                    </div>
                  )}
                </div>
              </form>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-5 border-t border-slate-200/70 text-xs text-slate-400">
        Careers at {effectiveCompanyName} • Powered by HireMind AI
      </footer>
    </div>
  );
}
