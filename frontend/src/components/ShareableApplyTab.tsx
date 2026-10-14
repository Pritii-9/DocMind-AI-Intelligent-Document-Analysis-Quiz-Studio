import { useState } from "react";
import { Copy, Check, ExternalLink, Share2, Globe, ShieldCheck } from "lucide-react";
import CandidateApply from "../pages/CandidateApply";

export default function ShareableApplyTab() {
  const [copied, setCopied] = useState(false);
  const applyUrl = `${window.location.origin}/apply`;

  const handleCopy = () => {
    navigator.clipboard.writeText(applyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Shareable Link Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-1">
              <Share2 size={14} />
              Candidate Ingestion Link
            </div>
            <h2 className="text-xl font-bold">Public Candidate Application Portal</h2>
            <p className="text-slate-300 text-xs mt-1 max-w-xl leading-relaxed">
              Share this link on LinkedIn, Twitter, job boards, or in candidate DMs. When a candidate submits their resume and GitHub, HireMind automatically evaluates them, logs them to Google Sheets, and alerts your team.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white text-slate-900 hover:bg-slate-100 transition shadow cursor-pointer"
            >
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              {copied ? "Link Copied!" : "Copy Public Link"}
            </button>
            <a
              href="/apply"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow cursor-pointer"
            >
              <ExternalLink size={14} />
              Open Live Form
            </a>
          </div>
        </div>

        {/* Link Bar */}
        <div className="mt-4 pt-4 border-t border-indigo-800/60 flex items-center gap-2 text-xs">
          <Globe size={14} className="text-indigo-400 shrink-0" />
          <span className="text-indigo-200 font-mono select-all bg-indigo-950/60 px-3 py-1.5 rounded-lg border border-indigo-700/50 flex-1 truncate">
            {applyUrl}
          </span>
          <span className="text-[11px] text-emerald-300 flex items-center gap-1 shrink-0">
            <ShieldCheck size={13} />
            No recruiter login required for applicants
          </span>
        </div>
      </div>

      {/* Live Preview Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Live Preview (What Candidates See)
          </span>
          <span className="text-[11px] text-slate-400">Interactive Preview</span>
        </div>
        <div className="max-h-[700px] overflow-y-auto">
          <CandidateApply />
        </div>
      </div>
    </div>
  );
}
