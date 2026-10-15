import { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Briefcase,
  Layers,
  ArrowRight,
} from "lucide-react";
import { resolveExperienceDetails, type ResolvedExperience } from "../utils/experienceParser";

interface ExperienceCheckCardProps {
  candidate: any;
  defaultJobTitle?: string;
  className?: string;
}

export default function ExperienceCheckCard({
  candidate,
  defaultJobTitle,
  className = "",
}: ExperienceCheckCardProps) {
  const [showNotes, setShowNotes] = useState(false);
  const exp: ResolvedExperience = resolveExperienceDetails(candidate, defaultJobTitle);

  // Restrained, subtle pastel badges with fine borders (minimalist SaaS palette)
  const statusConfig = {
    Exceeds: {
      badge: "bg-slate-100 text-slate-800 border-slate-200",
      icon: <Sparkles size={13} className="text-slate-600" />,
      label: "Exceeds Requirement",
    },
    Meets: {
      badge: "bg-emerald-50/80 text-emerald-800 border-emerald-200/80",
      icon: <CheckCircle2 size={13} className="text-emerald-700" />,
      label: "Experience Verified",
    },
    Under: {
      badge: "bg-amber-50/80 text-amber-800 border-amber-200/80",
      icon: <AlertTriangle size={13} className="text-amber-700" />,
      label: "Experience Gap",
    },
    Unspecified: {
      badge: "bg-slate-100 text-slate-700 border-slate-200",
      icon: <Clock size={13} className="text-slate-500" />,
      label: "Tenure Evaluated",
    },
  }[exp.status];

  const isUnder = exp.status === "Under";

  return (
    <div
      className={`bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs ${className}`}
    >
      {/* ── Header: Status & Metric Overview ── */}
      <div className="px-5 py-4 bg-slate-50/60 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${statusConfig.badge}`}
          >
            {statusConfig.icon}
            <span>{statusConfig.label}</span>
          </span>
          <span className="text-xs text-slate-700 font-medium">
            {exp.verdict}
          </span>
        </div>

        {/* Target vs Candidate Metrics */}
        <div className="inline-flex items-center gap-2.5 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs shrink-0 self-start sm:self-auto">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Briefcase size={12} className="text-slate-400" />
            <span>Target:</span>
            <span className="text-slate-900 font-semibold">{exp.requiredYears}</span>
          </div>
          <span className="text-slate-200 font-light">|</span>
          <div className="flex items-center gap-1.5 text-slate-500">
            <Clock size={12} className="text-slate-400" />
            <span>Resume:</span>
            <span className="text-slate-900 font-semibold">{exp.candidateYears}</span>
          </div>
        </div>
      </div>

      {/* ── Requirements Breakdown: Clean, Restrained Matrix ── */}
      {exp.breakdown.length > 0 && (
        <div className="p-5 bg-white">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Core Requirement Validation
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {exp.breakdown.map((item, idx) => {
              const isMatch = item.status === "match";
              const isPartial = item.status === "partial";
              return (
                <div
                  key={idx}
                  className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/50 flex flex-col justify-between gap-2"
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 shrink-0">
                      {isMatch ? (
                        <CheckCircle2 size={13} className="text-emerald-600" />
                      ) : isPartial ? (
                        <AlertTriangle size={13} className="text-amber-600" />
                      ) : (
                        <XCircle size={13} className="text-rose-500" />
                      )}
                    </div>
                    <span className="font-semibold text-xs text-slate-900 line-clamp-1">
                      {item.requirement}
                    </span>
                  </div>
                  <div className="pl-5 text-xs text-slate-500 font-mono truncate">
                    {item.candidate_match}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Action Decision Banner: Neutral, Refined Routing Notice ── */}
      {isUnder ? (
        <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <span className="font-semibold text-slate-900">Screening Action:</span>
            <span className="text-slate-600">
              Technical interview questions bypassed due to experience variance.
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-md text-xs self-start sm:self-auto shrink-0 shadow-2xs hover:bg-slate-50 transition-colors">
            <span>Route to Junior Pool</span>
            <ArrowRight size={12} className="text-slate-400" />
          </span>
        </div>
      ) : null}

      {/* ── Evaluation Summary (Collapsible) ── */}
      {candidate.reason && (
        <div className="px-5 py-3 bg-slate-50/40 border-t border-slate-100 text-xs">
          <button
            type="button"
            onClick={() => setShowNotes(!showNotes)}
            className="w-full flex items-center justify-between text-left text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <span className="text-xs font-medium flex items-center gap-1.5">
              <Layers size={13} className="text-slate-400" />
              <span>AI Evaluation Summary</span>
            </span>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <span>{showNotes ? "Hide" : "View"}</span>
              {showNotes ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </span>
          </button>
          {showNotes && (
            <p className="mt-2.5 text-xs text-slate-600 leading-relaxed bg-white p-3.5 rounded-lg border border-slate-200">
              {candidate.reason}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
