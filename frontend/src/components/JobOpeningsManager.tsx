import { useState, useEffect } from "react";
import {
  Plus,
  Copy,
  Check,
  Trash2,
  ArrowRight,
  FileText,
} from "lucide-react";
import { getJobOpenings, saveJobOpenings, addJobOpening, type JobOpening } from "../utils/jobStorage";
import { getPublicApplyUrl } from "../utils/appUrl";

interface JobOpeningsManagerProps {
  onSelectRoleForScreen: (job: JobOpening) => void;
}

export default function JobOpeningsManager({ onSelectRoleForScreen }: JobOpeningsManagerProps) {
  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewingJob, setViewingJob] = useState<JobOpening | null>(null);

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
    const url = getPublicApplyUrl(jobId);
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

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 font-[Inter,system-ui,sans-serif]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Job Openings &amp; Requisitions
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage active requisitions and candidate application routing.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-xs cursor-pointer active:scale-[0.99]"
        >
          <Plus size={14} />
          <span>Add New Job Role</span>
        </button>
      </div>

      {/* Grid of Job Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {jobs.map((job) => {
          const isActive = job.status === "active";
          return (
            <div
              key={job.id}
              className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Title & Status */}
                <div className="flex items-start justify-between gap-2.5 mb-2.5">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900 text-sm leading-snug truncate" title={job.title}>
                      {job.title}
                    </h3>
                    <p className="text-[11.5px] text-slate-500 mt-0.5">
                      {job.department} • {job.experience}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(job.id)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border cursor-pointer transition shrink-0 ${
                      isActive
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}
                  >
                    {isActive ? "Active" : "Closed"}
                  </button>
                </div>

                {/* Skills tags */}
                <div className="flex flex-wrap gap-1.5 my-3">
                  {job.skills.slice(0, 4).map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded text-[10.5px] font-medium bg-slate-50 text-slate-600 border border-slate-200/70"
                    >
                      {skill}
                    </span>
                  ))}
                  {job.skills.length > 4 && (
                    <span className="text-[10px] text-slate-400 self-center">
                      +{job.skills.length - 4}
                    </span>
                  )}
                </div>

                {/* Scannable Brief Excerpt / Details trigger */}
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={() => setViewingJob(job)}
                    className="text-[11.5px] text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 font-medium transition cursor-pointer"
                  >
                    <FileText size={12} className="text-slate-400" />
                    <span>View criteria &amp; description</span>
                  </button>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSelectRoleForScreen(job)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer shadow-2xs active:scale-[0.99]"
                    title="Load this role into Quick Screen"
                  >
                    <span>Quick Screen</span>
                    <ArrowRight size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyLink(job.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 transition cursor-pointer shadow-2xs"
                    title="Copy candidate application link for this job"
                  >
                    {copiedId === job.id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    <span>{copiedId === job.id ? "Copied" : "Copy Link"}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteJob(job.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                  title="Delete role"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Job Details Excerpt */}
      {viewingJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{viewingJob.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
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
            <div className="p-6 space-y-4">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                  Required Stack
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {viewingJob.skills.map((s, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200"
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
                <div className="text-xs text-slate-700 leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                  {viewingJob.description}
                </div>
              </div>
            </div>
            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setViewingJob(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectRoleForScreen(viewingJob);
                  setViewingJob(null);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition cursor-pointer"
              >
                Quick Screen this Role →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Job */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Create New Job Opening</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Role Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Backend Engineer"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    placeholder="Engineering / Product"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Experience</label>
                  <input
                    type="text"
                    placeholder="2-4 years"
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Required Skills (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="Python, FastAPI, Docker, PostgreSQL"
                  value={skillsStr}
                  onChange={(e) => setSkillsStr(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Job Description &amp; Evaluation Criteria *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Paste or type the role expectations and preferred stack..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 resize-none transition"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition cursor-pointer shadow-xs active:scale-[0.99]"
                >
                  Save Job Opening
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
