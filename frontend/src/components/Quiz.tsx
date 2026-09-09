import { useEffect, useState } from "react";
import { BookOpen, Plus, FileText, CheckCircle2, XCircle, ArrowRight, Trash2, Award } from "lucide-react";
import api from "../api/client";
import CustomSelect from "./CustomSelect";
import { useToast } from "../context/ToastContext";

interface QuizQuestion {
  id: string;
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correct: "A" | "B" | "C" | "D";
  explanation: string;
}

interface QuizItem {
  id: string;
  topic: string;
  doc_filename: string;
  document_id: string;
  questions: QuizQuestion[];
  created_at: string;
  last_score?: { score: number; total: number; pct: number; taken_at: string };
}

interface Doc { id: string; filename: string; }

const ACCENT        = "oklch(45% 0.033 256.848)";
const ACCENT_HOVER  = "oklch(52% 0.04 256.848)";
const ACCENT_LIGHT  = "oklch(96% 0.015 256.848)";

const S: React.CSSProperties = {
  background: "#ffffff", borderRadius: 14,
  boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.03)",
  border: "1px solid #e2e8f0", padding: "20px 22px",
};

export default function QuizView() {
  const { toast, confirm }            = useToast();
  const [quizzes, setQuizzes]         = useState<QuizItem[]>([]);
  const [docs, setDocs]               = useState<Doc[]>([]);
  const [loading, setLoading]         = useState(true);
  const [mode, setMode]               = useState<"list" | "generate" | "take" | "result">("list");
  const [activeQuiz, setActiveQuiz]   = useState<QuizItem | null>(null);
  const [selDoc, setSelDoc]           = useState("");
  const [count, setCount]             = useState(10);
  const [generating, setGen]          = useState(false);
  const [genError, setGenErr]         = useState("");
  const [answers, setAnswers]         = useState<Record<string, "A" | "B" | "C" | "D">>({});
  const [scoreResult, setScoreResult] = useState<{ score: number; total: number; pct: number } | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get("/quiz/list").then(r => r.data),
      api.get("/pdf/library").then(r => r.data),
    ]).then(([qList, docList]) => {
      setQuizzes(qList);
      setDocs(docList.filter((d: any) => (d.ai_index_status || "ready").toLowerCase() === "ready"));
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  async function generate() {
    if (!selDoc) return;
    setGen(true); setGenErr("");
    try {
      const { data } = await api.post("/quiz/generate", { document_id: selDoc, count });
      toast.success("Quiz generated successfully");
      await load();
      startQuiz(data);
    } catch (e: any) {
      setGenErr(e.response?.data?.detail || "Failed to generate quiz. Please try again.");
    } finally {
      setGen(false);
    }
  }

  function startQuiz(q: QuizItem) {
    setActiveQuiz(q); setAnswers({}); setScoreResult(null); setMode("take");
  }

  async function submitQuiz() {
    if (!activeQuiz) return;
    let correctCount = 0;
    activeQuiz.questions.forEach(q => { if (answers[q.id] === q.correct) correctCount++; });
    const total = activeQuiz.questions.length;
    const pct = Math.round((correctCount / total) * 100);
    const res = { score: correctCount, total, pct };
    setScoreResult(res); setMode("result");
    await api.post(`/quiz/${activeQuiz.id}/score`, { score: correctCount, total, pct }).catch(() => {});
    load();
  }

  async function deleteQuiz(q: QuizItem, e: React.MouseEvent) {
    e.stopPropagation();
    confirm({
      title: "Delete quiz?",
      message: `Are you sure you want to delete "${q.topic}"?`,
      confirmText: "Delete",
      danger: true,
      onConfirm: async () => {
        await api.delete(`/quiz/${q.id}`).catch(() => {});
        toast.success("Quiz deleted");
        load();
      },
    });
  }

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "80vh", gap: 12 }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #e2e8f0", borderTopColor: ACCENT }} className="spin" />
      <p style={{ fontSize: 13, color: "#64748b" }}>Loading quizzes…</p>
    </div>
  );

  return (
    <div className="animate-in" style={{ padding: "28px 32px", background: "#f8fafc", minHeight: "calc(100vh - 60px)", fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* LIST MODE */}
      {mode === "list" && (
        <>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: "#0f172a" }}>Quizzes</h1>
              <p style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>Practice and review key concepts from your PDFs.</p>
            </div>
            <button
              onClick={() => setMode("generate")}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: ACCENT, color: "#fff", border: "none",
                borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 600,
                cursor: "pointer", boxShadow: "0 4px 14px oklch(45% 0.033 256.848 / 0.3)", transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = ACCENT_HOVER; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = ACCENT; e.currentTarget.style.transform = "none"; }}
            >
              <Plus size={15} /> Create quiz
            </button>
          </div>

          {quizzes.length === 0 ? (
            <div style={{ ...S, textAlign: "center", padding: "52px 24px" }}>
              <BookOpen size={36} color="#cbd5e1" style={{ margin: "0 auto 12px" }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>No quizzes created yet</h3>
              <p style={{ color: "#64748b", fontSize: 13, marginBottom: 20 }}>Select an uploaded PDF and generate a practice quiz.</p>
              <button onClick={() => setMode("generate")} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Generate your first quiz
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {quizzes.map(q => (
                <div key={q.id} onClick={() => startQuiz(q)} style={{
                  ...S, cursor: "pointer", transition: "all 0.15s", position: "relative",
                  display: "flex", flexDirection: "column", justifyContent: "space-between",
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.08)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)"; e.currentTarget.style.transform = "none"; }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, background: ACCENT_LIGHT, color: ACCENT, padding: "3px 8px", borderRadius: 99 }}>
                        {q.questions.length} questions
                      </span>
                      <button onClick={e => deleteQuiz(q, e)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 2 }}
                        onMouseEnter={e => e.currentTarget.style.color = "#dc2626"}
                        onMouseLeave={e => e.currentTarget.style.color = "#94a3b8"}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 4, lineHeight: 1.3 }}>{q.topic}</h3>
                    <p style={{ fontSize: 12, color: "#64748b", margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
                      <FileText size={12} /> {q.doc_filename}
                    </p>
                  </div>

                  <div style={{ marginTop: 20, paddingTop: 12, borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    {q.last_score ? (
                      <span style={{ fontSize: 12, fontWeight: 700, color: q.last_score.pct >= 70 ? "#15803d" : "#d97706" }}>
                        Best: {q.last_score.score}/{q.last_score.total} ({q.last_score.pct}%)
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>Not taken yet</span>
                    )}
                    <span style={{ fontSize: 12, fontWeight: 600, color: ACCENT, display: "flex", alignItems: "center", gap: 4 }}>
                      Start <ArrowRight size={13} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* GENERATE MODE */}
      {mode === "generate" && (
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <button onClick={() => setMode("list")} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 13, marginBottom: 20, display: "flex", alignItems: "center", gap: 6, padding: 0, fontWeight: 600 }}>
            ← Back to quizzes
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>Generate quiz</h1>
          <p style={{ color: "#64748b", fontSize: 13, marginBottom: 24 }}>Choose a PDF document and question count to create a practice set.</p>

          <div style={{ ...S, display: "flex", flexDirection: "column", gap: 20 }}>
            {genError && (
              <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", color: "#dc2626", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                <XCircle size={15} style={{ flexShrink: 0 }} /> {genError}
              </div>
            )}

            <div>
              <CustomSelect
                label="Select document"
                placeholder="Choose a PDF document…"
                options={docs.map(d => ({ value: d.id, label: d.filename, icon: FileText }))}
                value={selDoc}
                onChange={val => setSelDoc(val)}
              />
            </div>

            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", marginBottom: 8 }}>
                Number of questions: <span style={{ color: ACCENT, fontSize: 14, fontWeight: 800 }}>{count}</span>
              </p>
              <input type="range" min={5} max={20} value={count} onChange={e => setCount(Number(e.target.value))} style={{ width: "100%", accentColor: ACCENT, cursor: "pointer" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                <span>5 questions</span><span>20 questions</span>
              </div>
            </div>

            <button
              onClick={generate} disabled={!selDoc || generating}
              style={{
                background: ACCENT, color: "#fff", border: "none", borderRadius: 10,
                padding: "11px 18px", fontSize: 13, fontWeight: 600, cursor: selDoc && !generating ? "pointer" : "not-allowed",
                opacity: selDoc && !generating ? 1 : 0.6, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "all 0.15s",
              }}
            >
              {generating ? (
                <>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid #fff", borderTopColor: "transparent" }} className="spin" />
                  Generating questions…
                </>
              ) : (
                "Generate quiz"
              )}
            </button>
          </div>
        </div>
      )}

      {/* TAKE MODE */}
      {mode === "take" && activeQuiz && (
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <button onClick={() => setMode("list")} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
              ← Exit quiz
            </button>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>
              {Object.keys(answers).length} of {activeQuiz.questions.length} answered
            </span>
          </div>

          <div style={{ ...S, marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>{activeQuiz.topic}</h2>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>From document: {activeQuiz.doc_filename}</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
            {activeQuiz.questions.map((q, idx) => (
              <div key={q.id} style={S}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>
                  <span style={{ color: ACCENT }}>{idx + 1}.</span> {q.question}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(["A", "B", "C", "D"] as const).map(opt => {
                    const isSel = answers[q.id] === opt;
                    return (
                      <button
                        key={opt}
                        onClick={() => setAnswers(p => ({ ...p, [q.id]: opt }))}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "10px 14px", borderRadius: 8,
                          border: `1px solid ${isSel ? ACCENT : "#e2e8f0"}`,
                          background: isSel ? ACCENT_LIGHT : "#ffffff",
                          color: isSel ? ACCENT : "#334155",
                          textAlign: "left", fontSize: 13, fontWeight: isSel ? 600 : 500,
                          cursor: "pointer", transition: "all 0.12s",
                        }}
                      >
                        <span style={{
                          width: 22, height: 22, borderRadius: "50%",
                          border: `1px solid ${isSel ? ACCENT : "#cbd5e1"}`,
                          background: isSel ? ACCENT : "transparent",
                          color: isSel ? "#ffffff" : "#64748b",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 700, flexShrink: 0,
                        }}>{opt}</span>
                        <span>{q.options[opt]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={submitQuiz}
            disabled={Object.keys(answers).length < activeQuiz.questions.length}
            style={{
              width: "100%", background: ACCENT, color: "#fff", border: "none",
              borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 700,
              cursor: Object.keys(answers).length === activeQuiz.questions.length ? "pointer" : "not-allowed",
              opacity: Object.keys(answers).length === activeQuiz.questions.length ? 1 : 0.5,
              transition: "all 0.15s", marginBottom: 40,
            }}
          >
            Submit quiz answers
          </button>
        </div>
      )}

      {/* RESULT MODE */}
      {mode === "result" && activeQuiz && scoreResult && (
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <button onClick={() => setMode("list")} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 13, marginBottom: 20, display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
            ← Back to quizzes
          </button>

          <div style={{ ...S, textAlign: "center", padding: "32px 24px", marginBottom: 24 }}>
            <Award size={40} color={ACCENT} style={{ margin: "0 auto 10px" }} />
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>Quiz completed!</h2>
            <p style={{ fontSize: 28, fontWeight: 800, color: ACCENT, margin: "12px 0 4px" }}>
              {scoreResult.score} / {scoreResult.total} ({scoreResult.pct}%)
            </p>
            <p style={{ fontSize: 13, color: "#64748b" }}>
              {scoreResult.pct >= 80 ? "Great job! You have a solid grasp of this material." : "Good effort. Review the detailed explanations below to improve."}
            </p>
          </div>

          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>Question review & explanations</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 40 }}>
            {activeQuiz.questions.map((q, idx) => {
              const userAns = answers[q.id];
              const isCorrect = userAns === q.correct;

              return (
                <div key={q.id} style={{
                  ...S,
                  borderColor: isCorrect ? "#bbf7d0" : "#fca5a5",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                    {isCorrect ? <CheckCircle2 size={18} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} /> : <XCircle size={18} color="#dc2626" style={{ flexShrink: 0, marginTop: 2 }} />}
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                        {idx + 1}. {q.question}
                      </p>
                    </div>
                  </div>

                  <div style={{ paddingLeft: 28, display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                    {(["A", "B", "C", "D"] as const).map(opt => {
                      const isTarget = opt === q.correct;
                      const isUser = opt === userAns;
                      let bg = "transparent";
                      let color = "#475569";
                      let weight = 400;

                      if (isTarget) { bg = "#dcfce7"; color = "#15803d"; weight = 600; }
                      else if (isUser && !isCorrect) { bg = "#fee2e2"; color = "#dc2626"; weight = 600; }

                      return (
                        <div key={opt} style={{ padding: "6px 10px", borderRadius: 6, background: bg, color, fontSize: 13, fontWeight: weight }}>
                          {opt}. {q.options[opt]} {isTarget && "✓ (Correct)"} {isUser && !isCorrect && "✗ (Your answer)"}
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ paddingLeft: 28, background: "#f8fafc", padding: "10px 14px", borderRadius: 8, borderLeft: `3px solid ${ACCENT}` }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", margin: "0 0 2px 0" }}>Explanation</p>
                    <p style={{ fontSize: 12, color: "#64748b", margin: 0, lineHeight: 1.5 }}>{q.explanation}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
