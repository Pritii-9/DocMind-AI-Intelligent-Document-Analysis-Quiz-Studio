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

export default function CandidateApply() {
  const { branding } = useCompany();
  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
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

    // Check URL query param e.g. /apply?role=job-ai-engineer
    try {
      const params = new URLSearchParams(window.location.search);
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

  const activeJob = jobs.find((j) => j.id === selectedJobId) || jobs[0];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setErrorMsg("Please upload a PDF resume.");
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
        setErrorMsg("Please upload a PDF resume.");
        return;
      }
      setResumeFile(file);
      setErrorMsg("");
    }
  };

  const cleanGithubUsername = (url: string) => {
    const clean = url.trim().replace(/^https?:\/\/(www\.)?github\.com\//i, "").replace(/\/+$/, "");
    return clean;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateName.trim()) {
      setErrorMsg("Please enter your full name.");
      return;
    }
    if (!candidateEmail.trim()) {
      setErrorMsg("Please enter your email address.");
      return;
    }
    if (!resumeFile) {
      setErrorMsg("Please upload your resume in PDF format.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      const ghUser = cleanGithubUsername(githubUrl);
      const targetJd = activeJob?.description || "Software Engineer role";
      const formData = new FormData();
      formData.append("job_description", targetJd);
      formData.append("github_username", ghUser);
      formData.append("resume_file", resumeFile);

      // 1. Screen candidate
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

      // 3. Log to Google Sheet with Role
      try {
        await api.post("/api/hire/log-to-sheets", {
          name: `${candidateName.trim()} [${activeJob?.title || "Candidate"}]`,
          score: data.screening?.score || 70,
          github_data: data.github_data || {},
          questions: questions,
        });
      } catch (err) {
        console.warn("Sheets logging:", err);
      }

      // Store in local applicant list for recruiter pipeline
      try {
        const existing = JSON.parse(localStorage.getItem("hiremind_candidates") || "[]");
        const newRecord = {
          id: Date.now().toString(),
          name: candidateName.trim(),
          role: activeJob?.title || "Software Engineer",
          email: candidateEmail.trim(),
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
          ? "Cloud server waking up from sleep. Please wait 15 seconds and click Submit again!"
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
              <img src={branding.logoUrl} alt={branding.name} className="w-full h-full object-contain p-1" />
            ) : (
              branding.name.slice(0, 2).toUpperCase() || "HM"
            )}
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-sm leading-tight flex items-center gap-1.5">
              <span>{branding.name} Careers</span>
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
              Thank you, <strong>{candidateName}</strong>. Your engineering profile has been submitted to <strong>{branding.name}</strong>. The hiring team has been notified.
            </p>
            <button
              onClick={() => {
                setSubmitted(false);
                setCandidateName("");
                setCandidateEmail("");
                setGithubUrl("");
                setResumeFile(null);
              }}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition"
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
                  <span>{branding.name} • Open Position</span>
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

              {/* Name & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex Morgan"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="alex@example.com"
                    value={candidateEmail}
                    onChange={(e) => setCandidateEmail(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* GitHub Profile */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  GitHub Profile URL or Username
                </label>
                <div className="relative">
                  <Github size={16} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="https://github.com/your-username"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Our system verifies repository history, top languages, and public code contributions.
                </p>
              </div>

              {/* Resume Upload */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Resume (PDF) <span className="text-red-500">*</span>
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                    isDragging
                      ? "border-indigo-600 bg-indigo-50/50 scale-[1.01]"
                      : "border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/20"
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
                    <div className="flex items-center gap-2 text-indigo-600 font-medium text-xs">
                      <FileText size={18} />
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
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer shadow-sm hover:shadow"
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
        Careers at {branding.name} • Powered by HireMind AI Candidate Intelligence
      </footer>
    </div>
  );
}
