import { useState, useEffect } from "react";
import {
  X,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Clock,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { createShareableEvalLink } from "../utils/shareEval";

interface ShareEvalModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: any;
}

export default function ShareEvalModal({ isOpen, onClose, candidate }: ShareEvalModalProps) {
  const [duration, setDuration] = useState<number>(30); // 30 minutes default
  const [shareUrl, setShareUrl] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && candidate) {
      setLoading(true);
      createShareableEvalLink(candidate, duration)
        .then((res) => {
          setShareUrl(res.shareUrl);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, candidate, duration]);

  if (!isOpen || !candidate) return null;

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs fade-in font-[Inter,system-ui,sans-serif]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200/90 w-full max-w-md overflow-hidden animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
              <Share2 size={16} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 leading-tight">
                Share Candidate Assessment
              </h3>
              <p className="text-xs text-slate-500 leading-tight mt-0.5">
                Generate a temporary, time-bound evaluation link
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg p-1 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Candidate Card Summary */}
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{candidate.name}</p>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                {candidate.role || "Software Engineer"} • Score: {candidate.score}/100
              </p>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {candidate.recommendation || "Recommended"}
            </span>
          </div>

          {/* Duration Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Clock size={13} className="text-slate-500" />
              <span>Link Expiration Window</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "30 Minutes", val: 30, tag: "Standard" },
                { label: "2 Hours", val: 120, tag: "Interview" },
                { label: "24 Hours", val: 1440, tag: "Executive" },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setDuration(opt.val)}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    duration === opt.val
                      ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  <p className="text-xs font-semibold leading-tight">{opt.label}</p>
                  <p
                    className={`text-[10px] mt-0.5 ${
                      duration === opt.val ? "text-slate-300" : "text-slate-400"
                    }`}
                  >
                    {opt.tag}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Link Container */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Shareable Link
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 flex items-center text-xs font-mono text-slate-700 overflow-x-auto select-all">
                {loading ? (
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Loader2 size={12} className="animate-spin" /> Generating link...
                  </span>
                ) : (
                  <span className="truncate">{shareUrl}</span>
                )}
              </div>
              <button
                type="button"
                onClick={handleCopy}
                disabled={loading || !shareUrl}
                className="h-9 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shrink-0 shadow-xs"
              >
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>

          {/* Privacy Note */}
          <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg flex items-start gap-2 text-xs text-indigo-950 leading-relaxed">
            <ShieldCheck size={16} className="text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-900">Zero-Login Recipient Access</p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Hiring managers and interviewers can view this full assessment and technical questions without an account. It automatically expires in {duration} minutes.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ExternalLink size={13} />
            <span>Open Link in New Tab</span>
          </a>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
