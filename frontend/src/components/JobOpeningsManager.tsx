import { useState, useEffect } from "react";
import {
  Briefcase,
  Plus,
  Copy,
  Check,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { getJobOpenings, saveJobOpenings, addJobOpening, type JobOpening } from "../utils/jobStorage";

interface JobOpeningsManagerProps {
  onSelectRoleForScreen: (job: JobOpening) => void;
}

export default function JobOpeningsManager({ onSelectRoleForScreen }: JobOpeningsManagerProps) {
  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
    const url = `${window.location.origin}/apply?role=${jobId}`;
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
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Briefcase className="text-indigo-600" size={20} />
            Startup Job Openings & Requisitions
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure active roles once. Pick them from dropdowns in Quick Screen and give candidates direct apply links.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow cursor-pointer"
        >
          <Plus size={15} />
          Add New Job Role
        </button>
      </div>

      {/* Grid of Job Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {jobs.map((job) => {
          const isActive = job.status === "active";
          return (
            <div
              key={job.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-slate-300 transition flex flex-col justify-between"
            >
              <div>
                {/* Title & Status */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm leading-snug">{job.title}</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {job.department} • {job.experience}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleStatus(job.id)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border cursor-pointer transition ${
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
                  {job.skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700"
                    >
                      {skill}
                    </span>
                  ))}
                </div>

                {/* Brief excerpt */}
                <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed mb-4">
                  {job.description}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onSelectRoleForScreen(job)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
                    title="Load this role into Quick Screen"
                  >
                    <span>Quick Screen</span>
                    <ArrowRight size={12} />
                  </button>
                  <button
                    onClick={() => handleCopyLink(job.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
                    title="Copy candidate application link for this job"
                  >
                    {copiedId === job.id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    <span>{copiedId === job.id ? "Copied" : "Apply Link"}</span>
                  </button>
                </div>

                <button
                  onClick={() => handleDeleteJob(job.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                  title="Delete role"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Create Job */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Create New Job Opening</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Frontend Engineer"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Experience</label>
                  <input
                    type="text"
                    placeholder="2-4 years"
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Required Skills (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="React, TypeScript, Tailwind, REST APIs"
                  value={skillsStr}
                  onChange={(e) => setSkillsStr(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Job Description & Evaluation Criteria *
                </label>
                <textarea
                  required
                  rows={5}
                  placeholder="Paste or type the role expectations, key requirements, and preferred stack..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition cursor-pointer shadow-sm"
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
