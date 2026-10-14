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
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      // 1. Screen candidate via AI pipeline
      const screenRes = await api.post("/api/hire/screen", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = screenRes.data;

      // 2. Generate questions
      let questions: any[] = [];
      try {
        const qRes = await api.post("/api/hire/generate-questions", {
          resume_text: data.resume_text_preview || "Technical candidate resume",
          jd: targetJd,
        });
        questions = qRes.data.questions || [];
      } catch (err) {
        console.warn("Questions generation skipped:", err);
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
      {/* Top Bar */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-xs ring-1 ring-slate-800 shadow-xs overflow-hidden">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={effectiveCompanyName} className="w-full h-full object-contain p-1" />
            ) : (
              effectiveCompanyName.slice(0, 2).toUpperCase() || "HM"
            )}
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-sm leading-tight flex items-center gap-1.5">
              <span>{effectiveCompanyName} Careers</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">PORTAL</span>
            </h1>
            <p className="text-[11px] text-slate-500">{branding.tagline || "Autonomous Talent Evaluation"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Accepting Applications
          </span>
          <a
            href="/"
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors hidden sm:inline-flex items-center gap-1"
          >
            <span>Recruiter portal</span>
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl w-full mx-auto px-4 py-8 flex-1">
        {submitted ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
            <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Application Received!</h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto mb-6">
              Thank you, <strong>{candidateName}</strong>. Your engineering profile has been submitted to <strong>{effectiveCompanyName}</strong> for the <strong>{activeJob?.title || "selected"}</strong> position. The hiring team has been notified.
            </p>
            <button
              onClick={() => {
                setSubmitted(false);
                setCandidateName("");
                setCandidateEmail("");
                setGithubUrl("");
                setResumeFile(null);
              }}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition cursor-pointer"
            >
              Submit Another Application
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Position Header with Role Selector */}
            <div className="border-b border-slate-100 p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
                  <Building2 size={14} />
                  <span>{effectiveCompanyName} • Open Position</span>
                </div>
                {jobs.length > 1 && (
                  <div className="relative inline-flex items-center">
                    <select
                      value={selectedJobId}
                      onChange={(e) => setSelectedJobId(e.target.value)}
                      className="h-7.5 pl-3 pr-7 text-xs bg-slate-800/90 hover:bg-slate-800 text-indigo-100 border border-indigo-700/50 hover:border-indigo-600 rounded-lg appearance-none font-medium focus:outline-none focus:ring-1.5 focus:ring-indigo-400 transition cursor-pointer"
                    >
                      {jobs.map((j) => (
                        <option key={j.id} value={j.id} className="bg-slate-900 text-white">
                          {j.title}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={12}
                      className="absolute right-2 text-indigo-300 pointer-events-none"
                    />
                  </div>
                )}
              </div>
              <h2 className="text-xl font-bold">{activeJob?.title || "Software Engineer"}</h2>
              <p className="text-slate-300 text-xs mt-1">
                {activeJob?.department || "Engineering"} • {activeJob?.experience || "Full-time"} •{" "}
                {activeJob?.skills?.join(", ") || "Python, React"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {errorMsg && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Name & Email Row */}
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
                    placeholder="Ada Lovelace"
                    className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={candidateEmail}
                    onChange={(e) => setCandidateEmail(e.target.value)}
                    placeholder="ada@example.com"
                    className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
                  />
                </div>
              </div>

              {/* GitHub Profile */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  GitHub Profile (Optional but Recommended)
                </label>
                <div className="relative flex items-center">
                  <Github size={15} className="absolute left-3 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/username or @username"
                    className="w-full h-9 border border-slate-200 rounded-lg pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Our AI evaluates repository architecture, commit velocity, and language proficiency.
                </p>
              </div>

              {/* PDF Resume Drag & Drop Upload */}
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
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                    isDragging
                      ? "border-indigo-500 bg-indigo-50/50"
                      : resumeFile
                      ? "border-emerald-300 bg-emerald-50/30"
                      : "border-slate-200 hover:border-slate-400 hover:bg-slate-50"
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
                    <div className="flex items-center gap-2 text-emerald-700 font-medium text-xs">
                      <FileText size={18} className="text-emerald-600" />
                      <span>{resumeFile.name} ({(resumeFile.size / 1024).toFixed(0)} KB)</span>
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                        <Upload size={18} />
                      </div>
                      <p className="text-xs text-slate-600 font-medium">
                        Click to upload your resume <span className="text-slate-400 font-normal">or drag & drop</span>
                      </p>
                      <p className="text-[10px] text-slate-400">PDF up to 10MB</p>
                    </>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 active:bg-black text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Analyzing profile with HireMind AI...</span>
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    <span>Submit Application</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-4 border-t border-slate-200 text-[11px] text-slate-400">
        Careers at {effectiveCompanyName} • Powered by HireMind AI Candidate Intelligence
      </footer>
    </div>
  );
}
