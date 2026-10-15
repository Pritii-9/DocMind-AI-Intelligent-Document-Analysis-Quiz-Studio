import { useState, useEffect } from "react";
import {
  Plus,
  Copy,
  Check,
  Trash2,
  ArrowRight,
  FileText,
  Search,
  Briefcase,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { getJobOpenings, saveJobOpenings, addJobOpening, type JobOpening } from "../utils/jobStorage";
import { getPublicApplyUrl } from "../utils/appUrl";
import { useCompany } from "../context/CompanyContext";

interface JobOpeningsManagerProps {
  onSelectRoleForScreen: (job: JobOpening) => void;
}

export default function JobOpeningsManager({ onSelectRoleForScreen }: JobOpeningsManagerProps) {
  const { branding } = useCompany();
  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewingJob, setViewingJob] = useState<JobOpening | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "closed">("all");

  // New Job Form State
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("Engineering");
  const [experience, setExperience] = useState("2-4 years");
  const [skillsStr, setSkillsStr] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    setJobs(getJobOpenings());
  }, []);

  const handleCopyLink = (jobId: string) => {
    const url = getPublicApplyUrl({ roleId: jobId, companyName: branding.name });
    navigator.clipboard.writeText(url);
    setCopiedId(jobId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleStatus = (id: string) => {
    const updated = jobs.map((j) => {
      if (j.id === id) {
        return { ...j, status: j.status === "active" ? ("closed" as const) : ("active" as const) };
      }
      return j;
    });
    setJobs(updated);
    saveJobOpenings(updated);
  };

  const handleDeleteJob = (id: string) => {
    if (confirm("Are you sure you want to delete this job opening?")) {
      const updated = jobs.filter((j) => j.id !== id);
      setJobs(updated);
      saveJobOpenings(updated);
    }
  };

  const handleCreateJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    const skills = skillsStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    addJobOpening({
      title: title.trim(),
      department: department.trim() || "Engineering",
      experience: experience.trim() || "2+ years",
      skills: skills.length > 0 ? skills : ["Python", "React"],
      description: description.trim(),
      status: "active",
    });

    setJobs(getJobOpenings());
    setShowModal(false);
    setTitle("");
    setSkillsStr("");
    setDescription("");
  };

  const filtered = jobs.filter((j) => {
    const matchesSearch =
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.department.toLowerCase().includes(search.toLowerCase()) ||
      j.skills.some((s) => s.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;
    if (statusFilter === "active" && j.status !== "active") return false;
    if (statusFilter === "closed" && j.status !== "closed") return false;
    return true;
  });

  const totalCount = jobs.length;
  const activeCount = jobs.filter((j) => j.status === "active").length;
  const closedCount = totalCount - activeCount;

  return (
    <div className="px-6 py-5 max-w-7xl mx-auto space-y-3.5 font-[Inter,system-ui,sans-serif]">
      {/* ── Header with Inline KPI Capsule ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-900 leading-tight">
              Job Openings
            </h1>
            <p className="text-xs text-slate-500">
              Active requisitions &amp; candidate application routing
            </p>
          </div>

          {/* High-density inline KPI capsule */}
          <div className="hidden md:flex items-center gap-2.5 bg-white border border-slate-200 px-3 py-1 rounded-lg text-xs shadow-2xs ml-3">
            <span className="text-slate-500">
              Total: <strong className="text-slate-900 font-semibold">{totalCount}</strong>
            </span>
            <span className="text-slate-200">|</span>
            <span className="text-slate-500">
              Active: <strong className="text-emerald-700 font-semibold">{activeCount}</strong>
            </span>
            <span className="text-slate-200">|</span>
            <span className="text-slate-500">
              Closed: <strong className="text-slate-600 font-semibold">{closedCount}</strong>
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition shadow-xs cursor-pointer active:scale-[0.99] self-start sm:self-auto"
        >
          <Plus size={13} />
          <span>Add Job Role</span>
        </button>
      </div>

      {/* ── Single-Line Streamlined Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white border border-slate-200/90 px-3 py-2 rounded-lg shadow-2xs">
        {/* Compact Search Input */}
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search roles, department, skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-7 pl-7 pr-2.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-400 transition"
          />
        </div>

        {/* Filter Pills */}
        <div className="inline-flex p-0.5 bg-slate-100 rounded-md border border-slate-200/80 text-[11px]">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-2.5 py-0.5 rounded font-medium transition cursor-pointer ${
              statusFilter === "all"
                ? "bg-white text-slate-900 shadow-2xs font-semibold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            All ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={`px-2.5 py-0.5 rounded font-medium transition cursor-pointer ${
              statusFilter === "active"
                ? "bg-white text-slate-900 shadow-2xs font-semibold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("closed")}
            className={`px-2.5 py-0.5 rounded font-medium transition cursor-pointer ${
              statusFilter === "closed"
                ? "bg-white text-slate-900 shadow-2xs font-semibold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Closed ({closedCount})
          </button>
        </div>
      </div>

      {/* ── High-Density Job Requisitions Table (Zero-Scroll Layout) ── */}
      <div className="bg-white border border-slate-200/90 rounded-lg overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-4 w-[30%]">Role &amp; Department</th>
                <th className="py-2.5 px-3 w-[15%]">Experience Bar</th>
                <th className="py-2.5 px-3 w-[27%]">Target Stack</th>
                <th className="py-2.5 px-3 w-[10%]">Status</th>
                <th className="py-2.5 px-4 w-[18%] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                    No job openings match your current filter.
                  </td>
                </tr>
              ) : (
                filtered.map((job) => {
                  const isActive = job.status === "active";

                  return (
                    <tr key={job.id} className="group hover:bg-slate-50/60 transition-colors">
                      {/* Role & Department */}
                      <td className="py-2.5 px-4 align-middle">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                            <Briefcase size={13} />
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-900 text-xs block truncate">
                              {job.title}
                            </span>
                            <span className="text-[11px] text-slate-500 block truncate">
                              {job.department}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Experience Bar */}
                      <td className="py-2.5 px-3 align-middle text-slate-700 font-medium text-xs">
                        {job.experience}
                      </td>

                      {/* Target Stack */}
                      <td className="py-2.5 px-3 align-middle">
                        <div className="flex items-center gap-1 flex-wrap">
                          {job.skills.slice(0, 3).map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 rounded text-[10.5px] font-mono font-medium bg-slate-50 text-slate-700 border border-slate-200/80"
                            >
                              {skill}
                            </span>
                          ))}
                          {job.skills.length > 3 && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              +{job.skills.length - 3}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status Toggle */}
                      <td className="py-2.5 px-3 align-middle">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(job.id)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border cursor-pointer transition ${
                            isActive
                              ? "bg-emerald-50/80 text-emerald-800 border-emerald-200/80 hover:bg-emerald-100/70"
                              : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/60"
                          }`}
                          title="Click to toggle active/closed status"
                        >
                          {isActive ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                          <span>{isActive ? "Active" : "Closed"}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-4 align-middle text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() => onSelectRoleForScreen(job)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer shadow-xs active:scale-[0.99]"
                            title="Screen candidate against this role"
                          >
                            <span>Quick Screen</span>
                            <ArrowRight size={11} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopyLink(job.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
                            title="Copy application link for this role"
                          >
                            {copiedId === job.id ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} className="text-slate-400" />}
                            <span>{copiedId === job.id ? "Copied" : "Link"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setViewingJob(job)}
                            className="p-1 text-slate-400 hover:text-slate-800 rounded transition cursor-pointer"
                            title="View criteria and description"
                          >
                            <FileText size={13} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteJob(job.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                            title="Delete role"
                          >
                            <Trash2 size={13} />
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

      {/* ── Modal: Job Details Excerpt ── */}
      {viewingJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm tracking-tight">{viewingJob.title}</h3>
                <p className="text-xs text-slate-500">
                  {viewingJob.department} • {viewingJob.experience}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingJob(null)}
                className="text-slate-400 hover:text-slate-600 text-sm p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-3.5">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                  Required Stack
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {viewingJob.skills.map((s, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-slate-50 text-slate-700 border border-slate-200"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                  Job Description &amp; Evaluation Criteria
                </span>
                <div className="text-xs text-slate-700 leading-relaxed max-h-56 overflow-y-auto whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                  {viewingJob.description}
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setViewingJob(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectRoleForScreen(viewingJob);
                  setViewingJob(null);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition cursor-pointer shadow-xs"
              >
                Quick Screen this Role →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Create Job ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">Create Job Requisition</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Backend Engineer"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    placeholder="Engineering / Product"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Experience Bar</label>
                  <input
                    type="text"
                    placeholder="2-4 years"
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Required Skills (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="Python, FastAPI, Docker, PostgreSQL"
                  value={skillsStr}
                  onChange={(e) => setSkillsStr(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Job Description &amp; Evaluation Criteria *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Paste role expectations, core responsibilities, and preferred stack..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 resize-none transition"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition cursor-pointer shadow-xs active:scale-[0.99]"
                >
                  Save Requisition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
