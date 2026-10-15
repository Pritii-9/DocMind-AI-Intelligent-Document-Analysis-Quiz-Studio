import { useState } from "react";
import { Copy, Check, ExternalLink, Globe, ShieldCheck } from "lucide-react";
import { getPublicApplyUrl, PRODUCTION_FRONTEND_URL } from "../utils/appUrl";
import { useCompany } from "../context/CompanyContext";

export default function ShareableApplyTab() {
  const { branding } = useCompany();
  const [copied, setCopied] = useState(false);
  const isLocalDev = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const [useLocalOrigin, setUseLocalOrigin] = useState(false);

  // Default to the live deployment URL with company tagging so candidates receive a reachable URL
  const applyUrl = getPublicApplyUrl({ companyName: branding.name, forceLocal: useLocalOrigin });

  const handleCopy = () => {
    navigator.clipboard.writeText(applyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="px-6 py-5 max-w-7xl mx-auto space-y-3.5 font-[Inter,system-ui,sans-serif]">
      {/* ── Page Header with Status Capsule ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div>
          <h1 className="text-base font-bold tracking-tight text-slate-900 leading-tight">
            Public Apply Portal
          </h1>
          <p className="text-xs text-slate-500">
            Candidate ingestion and public application link for <strong className="text-slate-700">{branding.name}</strong>
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-lg shadow-2xs">
          <ShieldCheck size={13} className="text-emerald-600" />
          <span>Status: <strong className="text-slate-900 font-semibold">Active &amp; Accepting Candidates</strong></span>
        </div>
      </div>

      {/* Clean Card */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-700">
              Public Apply Link
            </label>
            {isLocalDev && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Target:</span>
                <button
                  type="button"
                  onClick={() => setUseLocalOrigin(false)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    !useLocalOrigin
                      ? "bg-slate-900 text-white font-semibold"
                      : "bg-slate-100 text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Production (Vercel)
                </button>
                <button
                  type="button"
                  onClick={() => setUseLocalOrigin(true)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    useLocalOrigin
                      ? "bg-slate-900 text-white font-semibold"
                      : "bg-slate-100 text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Local Dev
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Monospace Pill / Input */}
            <div className="flex-1 flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-xs text-slate-800 font-mono select-all overflow-x-auto">
              <Globe size={14} className="text-slate-400 shrink-0" />
              <span className="truncate">{applyUrl}</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopy}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 active:bg-black text-white transition-all shadow-xs cursor-pointer active:scale-[0.99]"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copied ? "Link Copied!" : "Copy Link"}</span>
              </button>

              <a
                href={applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-all shadow-xs cursor-pointer"
              >
                <ExternalLink size={14} className="text-slate-500" />
                <span>Preview Form</span>
              </a>
            </div>
          </div>
        </div>

        {/* Subtle Indicator Notes */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
            <span>No recruiter login required for applicants.</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Deployed on Vercel: <span className="font-mono text-slate-600">{PRODUCTION_FRONTEND_URL}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
