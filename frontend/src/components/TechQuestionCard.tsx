import { useState } from "react";
import {
  Code2,
  Database,
  Layers,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Sparkles,
} from "lucide-react";

export interface QuestionData {
  question: string;
  topic?: string;
  difficulty?: string;
  category?: string;
  evaluation_criteria?: string;
}

interface TechQuestionCardProps {
  question: QuestionData;
  index: number;
}

export default function TechQuestionCard({ question, index }: TechQuestionCardProps) {
  const [copied, setCopied] = useState(false);
  const [showRubric, setShowRubric] = useState(false);

  const topicText = question.topic || "";
  const catText = question.category || "";
  const fullContext = `${catText} ${topicText} ${question.question}`.toLowerCase();

  // Determine pillar & restrained icon
  let pillarName = "Core Language Fundamentals";
  let pillarIcon = <Code2 size={13} className="text-slate-600" />;

  if (fullContext.includes("sql") || fullContext.includes("database") || fullContext.includes("pgvector") || fullContext.includes("index")) {
    pillarName = "Database & Query Optimization";
    pillarIcon = <Database size={13} className="text-slate-600" />;
  } else if (fullContext.includes("system") || fullContext.includes("design") || fullContext.includes("architecture") || fullContext.includes("concurrency") || fullContext.includes("redis") || fullContext.includes("scale")) {
    pillarName = "System Design & Architecture";
    pillarIcon = <Layers size={13} className="text-slate-600" />;
  }

  const isHard = (question.difficulty || "").toLowerCase() === "hard";

  const handleCopy = () => {
    const textToCopy = `Pillar ${index + 1}: ${pillarName}
Topic: ${question.topic || "General"} (${question.difficulty || "Medium"})

Question:
${question.question}

Expected Senior Candidate Answer:
${question.evaluation_criteria || "Look for practical experience with trade-offs, edge cases, and memory/system performance."}`;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs transition-all hover:border-slate-300">
      {/* Header Bar */}
      <div className="px-5 py-3.5 bg-slate-50/60 border-b border-slate-200/80 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="w-5 h-5 rounded bg-slate-900 text-white text-[11px] font-mono font-bold flex items-center justify-center shrink-0">
            {index + 1}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-white text-slate-700 border border-slate-200 shadow-2xs">
            {pillarIcon}
            <span>{pillarName}</span>
          </span>
          <span
            className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${
              isHard
                ? "bg-slate-100 text-slate-800 border-slate-200"
                : "bg-slate-50 text-slate-600 border-slate-200"
            }`}
          >
            {question.difficulty || "Medium"}
          </span>
        </div>

        {/* Copy for Interview Notes */}
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 px-2.5 py-1 rounded-md transition cursor-pointer shrink-0 shadow-2xs"
          title="Copy question and rubric to clipboard"
        >
          {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} className="text-slate-400" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>

      {/* Main Question Body */}
      <div className="p-5 space-y-3.5">
        {question.topic && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Sparkles size={12} className="text-slate-400 shrink-0" />
            <span>Target Concept:</span>
            <span className="text-slate-900 font-semibold">{question.topic}</span>
          </div>
        )}

        <p className="text-sm text-slate-800 leading-relaxed font-normal bg-slate-50/50 p-4 rounded-lg border border-slate-200/70">
          {question.question}
        </p>

        {/* Collapsible Expected Senior Answer / Rubric */}
        <div className="pt-0.5">
          <button
            type="button"
            onClick={() => setShowRubric(!showRubric)}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <HelpCircle size={13} className="text-slate-400" />
            <span>{showRubric ? "Hide Evaluation Criteria" : "What to look for in candidate's response"}</span>
            {showRubric ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {showRubric && (
            <div className="mt-2.5 p-4 bg-slate-50 border border-slate-200/80 rounded-lg text-xs text-slate-700 leading-relaxed space-y-1">
              <span className="block font-semibold text-slate-900">
                Evaluation Rubric:
              </span>
              <p className="text-slate-600">
                {question.evaluation_criteria ||
                  "Candidate should address practical trade-offs, runtime complexity, memory implications, and real-world edge cases."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
