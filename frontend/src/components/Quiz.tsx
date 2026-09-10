import { useEffect, useState } from "react";
import { BookOpen, Plus, FileText, CheckCircle2, XCircle, ArrowRight, Trash2, Award, MessageSquare, HelpCircle, RotateCcw, Search } from "lucide-react";
import api from "../api/client";
import CustomSelect from "./CustomSelect";
import { useToast } from "../context/ToastContext";

interface QuizQuestion {
  id: string;
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correct: "A" | "B" | "C" | "D";
  explanation: string;
  user_note?: string;
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

function normalizeQuiz(raw: Record<string, any>): QuizItem {
  return {
    ...raw,
    id: raw.id || raw._id,
    doc_filename: raw.doc_filename || raw.document_name || "Untitled document",
    document_id: raw.document_id || "",
    questions: raw.questions || [],
  } as QuizItem;
}

function getApiErrorMessage(error: unknown): string {
  const response = (error as { response?: { data?: { detail?: unknown } } }).response;
  const detail = response?.data?.detail;

  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map(item => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "msg" in item) {
          return String(item.msg);
        }
        return "Invalid request";
      })
      .join(". ");
  }
  return "Failed to generate quiz. Please try again.";
}

const ACCENT        = "var(--brand)";
const ACCENT_HOVER  = "var(--brand-hover)";
const ACCENT_LIGHT  = "var(--brand-light)";
const CARD_BG       = "#ffffff";

const S: React.CSSProperties = {
  background: CARD_BG,
  borderRadius: 14,
  boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)",
  border: "1px solid #e2e8f0",
  padding: "20px 22px",
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
  const [topic, setTopic]             = useState("");
  const [purpose, setPurpose]         = useState("");
  const [generating, setGen]          = useState(false);
  const [genError, setGenErr]         = useState("");
  const [quizSearch, setQuizSearch]   = useState("");

  // Take Mode States
  const [answers, setAnswers]         = useState<Record<string, "A" | "B" | "C" | "D">>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [revealedExplanations, setRevealedExplanations] = useState<Record<string, boolean>>({});
  const [comments, setComments]       = useState<Record<string, string>>({});
  const [commentOpen, setCommentOpen] = useState<Record<string, boolean>>({});
  const [scoreResult, setScoreResult] = useState<{ score: number; total: number; pct: number } | null>(null);
  const [resultFilter, setResultFilter] = useState<"all" | "correct" | "incorrect">("all");

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get("/quiz/list").then(r => r.data),
      api.get("/pdf/library").then(r => r.data),
    ]).then(([qList, docList]) => {
      setQuizzes(qList.map((quiz: Record<string, any>) => normalizeQuiz(quiz)));
      setDocs(docList.filter((d: any) => (d.ai_index_status || "ready").toLowerCase() === "ready"));
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  async function generate() {
    if (!selDoc) return;
    setGen(true); setGenErr("");
    try {
      const { data } = await api.post("/quiz/generate", {
        doc_id: selDoc,
        count,
        topic: topic.trim() || null,
        purpose: purpose.trim() || null,
      });
      toast.success("Quiz generated successfully!");
      await load();
      startQuiz(normalizeQuiz(data));
    } catch (e: unknown) {
      setGenErr(getApiErrorMessage(e));
    } finally {
      setGen(false);
    }
  }

  function startQuiz(q: QuizItem) {
    setActiveQuiz(q);
    setAnswers({});
    setCurrentQuestion(0);
    setRevealedExplanations({});
    setComments(Object.fromEntries(q.questions.map(question => [question.id, question.user_note || ""])));
    setCommentOpen({});
    setScoreResult(null);
    setResultFilter("all");
    setMode("take");
  }

  function selectOption(qId: string, opt: "A" | "B" | "C" | "D") {
    setAnswers(p => ({ ...p, [qId]: opt }));
  }

  function toggleExplanation(qId: string) {
    setRevealedExplanations(p => ({ ...p, [qId]: !p[qId] }));
  }

  async function saveComment(questionId: string) {
    if (!activeQuiz) return;
    await api.patch(`/quiz/${activeQuiz.id}/note`, {
      question_id: questionId,
      note: comments[questionId] || "",
    });
    toast.success("Note saved");
    setCommentOpen(previous => ({ ...previous, [questionId]: false }));
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "calc(100vh - 60px)", gap: 12 }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #e2e8f0", borderTopColor: ACCENT }} className="spin" />
      <p style={{ fontSize: 13, color: "#64748b" }}>Loading quizzes…</p>
    </div>
  );

  return (
    <div
      className="quiz-shell animate-in"
      style={{
        padding: "24px 28px",
        background: "#f8fafc",
        height: mode === "take" ? "calc(100vh - 60px)" : "auto",
        minHeight: mode === "take" ? "auto" : "calc(100vh - 60px)",
        boxSizing: "border-box",
        overflow: mode === "take" ? "hidden" : "auto",
        fontFamily: "'Inter', system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >

      {/* ── LIST MODE ── */}
      {mode === "list" && (
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: "#0f172a" }}>Quizzes</h1>
              <p style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>
                Practice questions and review key concepts from your document library.
              </p>
            </div>
            <button
              onClick={() => setMode("generate")}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: ACCENT, color: "#fff", border: "none",
                borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 600,
                cursor: "pointer", boxShadow: "0 4px 14px rgba(61,79,110,0.25)", transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = ACCENT_HOVER; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = ACCENT; e.currentTarget.style.transform = "none"; }}
            >
              <Plus size={15} /> Create quiz
            </button>
          </div>

          {quizzes.length > 0 && (
            <div style={{ marginBottom: 16, display: "flex", justifyContent: "flex-end" }}>
              <div style={{ position: "relative", width: 280 }}>
                <Search size={14} color="#94a3b8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  value={quizSearch}
                  onChange={e => setQuizSearch(e.target.value)}
                  placeholder="Search quizzes by topic or doc…"
                  style={{
                    width: "100%", boxSizing: "border-box", padding: "8px 12px 8px 34px", borderRadius: 8,
                    border: "1px solid #cbd5e1", background: "#ffffff", fontSize: 12.5, color: "#0f172a", outline: "none",
                  }}
                />
              </div>
            </div>
          )}

          {quizzes.length === 0 ? (
            <div style={{ ...S, textAlign: "center", padding: "40px 24px" }}>
              <BookOpen size={40} color="#cbd5e1" style={{ margin: "0 auto 12px" }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>No quizzes generated yet</h3>
              <p style={{ color: "#64748b", fontSize: 13, marginBottom: 20 }}>Select an uploaded PDF to auto-generate multiple-choice practice sets.</p>
              <button onClick={() => setMode("generate")} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 9, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Generate your first quiz
              </button>
            </div>
          ) : (
            <div className="quiz-card-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 14 }}>
              {quizzes
                .filter(q => q.topic.toLowerCase().includes(quizSearch.toLowerCase()) || q.doc_filename.toLowerCase().includes(quizSearch.toLowerCase()))
                .map(q => (
                <div key={q.id} onClick={() => startQuiz(q)} style={{
                  ...S, padding: "18px 20px", cursor: "pointer", transition: "all 0.18s ease", position: "relative",
                  display: "flex", flexDirection: "column", justifyContent: "space-between",
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.07)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)"; e.currentTarget.style.transform = "none"; }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, background: ACCENT_LIGHT, color: ACCENT, padding: "3px 9px", borderRadius: 99, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <BookOpen size={11} /> {q.questions.length} Questions
                      </span>
                      <button onClick={e => deleteQuiz(q, e)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 3, borderRadius: 6 }}
                        onMouseEnter={e => e.currentTarget.style.color = "#dc2626"}
                        onMouseLeave={e => e.currentTarget.style.color = "#94a3b8"}
                        title="Delete quiz"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 6, lineHeight: 1.35 }}>{q.topic}</h3>
                    <p style={{ fontSize: 12, color: "#64748b", margin: 0, display: "flex", alignItems: "center", gap: 5 }}>
                      <FileText size={13} color="#94a3b8" /> {q.doc_filename}
                    </p>
                  </div>

                  <div style={{ marginTop: 22, paddingTop: 14, borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    {q.last_score ? (
                      <span style={{ fontSize: 12, fontWeight: 700, color: q.last_score.pct >= 70 ? "#15803d" : "#d97706" }}>
                        Best: {q.last_score.score}/{q.last_score.total} ({q.last_score.pct}%)
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>Not taken yet</span>
                    )}
                    <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT, display: "flex", alignItems: "center", gap: 4 }}>
                      Start Quiz <ArrowRight size={13} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── GENERATE MODE ── */}
      {mode === "generate" && (
        <div className="quiz-form-panel" style={{ maxWidth: 740, margin: "0 auto", width: "100%" }}>
          <button onClick={() => setMode("list")} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 13, marginBottom: 20, display: "flex", alignItems: "center", gap: 6, padding: 0, fontWeight: 600 }}>
            ← Back to quizzes
          </button>

          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>Generate Quiz</h1>
            <p style={{ color: "#64748b", fontSize: 13 }}>Choose a PDF document and question count to create a practice set.</p>
          </div>

          <div style={{ ...S, display: "flex", flexDirection: "column", gap: 20 }}>
            {genError && (
              <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "11px 14px", color: "#dc2626", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                <XCircle size={16} style={{ flexShrink: 0 }} /> {genError}
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
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", marginBottom: 8 }}>
                Topic focus <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
              </label>
              <input
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g. Memory Management & Garbage Collection"
                style={{ width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#0f172a", outline: "none" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", marginBottom: 8 }}>
                Quiz purpose <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
              </label>
              <textarea
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                placeholder="e.g. Exam prep with conceptual questions and explanation details"
                rows={3}
                style={{ width: "100%", boxSizing: "border-box", resize: "vertical", border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#0f172a", outline: "none", fontFamily: "inherit" }}
              />
            </div>

            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", marginBottom: 8 }}>
                Number of questions: <span style={{ color: ACCENT, fontSize: 14, fontWeight: 800 }}>{count}</span>
              </p>
              <input type="range" min={5} max={50} value={count} onChange={e => setCount(Number(e.target.value))} style={{ width: "100%", accentColor: ACCENT, cursor: "pointer" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                <span>5 questions</span><span>50 questions</span>
              </div>
            </div>

            <button
              onClick={generate} disabled={!selDoc || generating}
              style={{
                background: ACCENT, color: "#fff", border: "none", borderRadius: 10,
                padding: "12px 18px", fontSize: 13, fontWeight: 600, cursor: selDoc && !generating ? "pointer" : "not-allowed",
                opacity: selDoc && !generating ? 1 : 0.6, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "all 0.15s",
              }}
            >
              {generating ? (
                <>
                  <div style={{ width: 15, height: 15, borderRadius: "50%", border: "2px solid #fff", borderTopColor: "transparent" }} className="spin" />
                  Generating quiz…
                </>
              ) : (
                "Generate Quiz"
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── TAKE MODE (LIVE QUIZ WINDOW - CLEAN & FOCUSED) ── */}
      {mode === "take" && activeQuiz && (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", maxWidth: 900, width: "100%", margin: "0 auto", gap: 12 }}>

          {/* Top Bar Navigation & Title */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "#ffffff", padding: "12px 18px", borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", flexShrink: 0 }}>
            <button onClick={() => setMode("list")} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6, fontWeight: 600, padding: 0 }}>
              ← Exit
            </button>

            <div style={{ textAlign: "center", flex: 1, padding: "0 12px", minWidth: 0 }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {activeQuiz.topic}
              </h2>
              <span style={{ fontSize: 11, color: "#64748b", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 1 }}>
                <FileText size={11} /> {activeQuiz.doc_filename}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT, background: ACCENT_LIGHT, padding: "4px 10px", borderRadius: 8 }}>
                Question {currentQuestion + 1} / {activeQuiz.questions.length}
              </span>
            </div>
          </div>

          {/* Progress Bar & Quick Jump Navigation Pills */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
            <div style={{ height: 4, background: "#e2e8f0", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ width: `${((currentQuestion + 1) / activeQuiz.questions.length) * 100}%`, height: "100%", background: ACCENT, transition: "width 0.2s ease" }} />
            </div>

            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
              {activeQuiz.questions.map((qItem, idx) => {
                const isCurr = idx === currentQuestion;
                const hasAns = !!answers[qItem.id];
                const isExplRevealed = !!revealedExplanations[qItem.id];

                let bg = "#ffffff";
                let border = "#cbd5e1";
                let color = "#64748b";

                if (isCurr) {
                  bg = ACCENT_LIGHT; border = ACCENT; color = ACCENT;
                } else if (hasAns) {
                  bg = "#f0fdf4"; border = "#bbf7d0"; color = "#15803d";
                }

                return (
                  <button
                    key={qItem.id}
                    onClick={() => setCurrentQuestion(idx)}
                    style={{
                      minWidth: 30, height: 30, borderRadius: 8, border: `1px solid ${border}`,
                      background: bg, color, fontSize: 12, fontWeight: isCurr ? 800 : 600,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.12s", flexShrink: 0, position: "relative",
                    }}
                  >
                    {idx + 1}
                    {isExplRevealed && <div style={{ position: "absolute", top: 2, right: 2, width: 4, height: 4, borderRadius: "50%", background: "#16a34a" }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Question Window Card */}
          {(() => {
            const q = activeQuiz.questions[currentQuestion];
            const userSelected = answers[q.id];
            const isRevealed = !!revealedExplanations[q.id];
            const isCorrect = userSelected === q.correct;

            return (
              <div style={{ ...S, padding: 0, flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>

                {/* Scrollable Question Content Container */}
                <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

                  {/* Question Prompt */}
                  <p style={{ fontSize: 15.5, fontWeight: 700, color: "#0f172a", lineHeight: 1.45, margin: 0 }}>
                    <span style={{ color: ACCENT, marginRight: 6 }}>{currentQuestion + 1}.</span> {q.question}
                  </p>

                  {/* 4 Option Buttons */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                    {(["A", "B", "C", "D"] as const).map(opt => {
                      const isSel = userSelected === opt;
                      const isRightOpt = opt === q.correct;

                      let optBg = "#ffffff";
                      let optBorder = "#e2e8f0";
                      let optTextColor = "#334155";
                      let badgeBg = "transparent";
                      let badgeBorder = "#cbd5e1";
                      let badgeTextColor = "#64748b";

                      if (isRevealed) {
                        if (isRightOpt) {
                          optBg = "#f0fdf4"; optBorder = "#bbf7d0"; optTextColor = "#15803d";
                          badgeBg = "#16a34a"; badgeBorder = "#16a34a"; badgeTextColor = "#ffffff";
                        } else if (isSel && !isRightOpt) {
                          optBg = "#fef2f2"; optBorder = "#fca5a5"; optTextColor = "#b91c1c";
                          badgeBg = "#dc2626"; badgeBorder = "#dc2626"; badgeTextColor = "#ffffff";
                        }
                      } else if (isSel) {
                        optBg = ACCENT_LIGHT; optBorder = ACCENT; optTextColor = ACCENT;
                        badgeBg = ACCENT; badgeBorder = ACCENT; badgeTextColor = "#ffffff";
                      }

                      return (
                        <button
                          key={opt}
                          onClick={() => selectOption(q.id, opt)}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                            padding: "11px 15px", borderRadius: 10,
                            border: `1px solid ${optBorder}`,
                            background: optBg,
                            color: optTextColor,
                            textAlign: "left", fontSize: 13, fontWeight: isSel || (isRevealed && isRightOpt) ? 600 : 500,
                            cursor: "pointer", transition: "all 0.12s ease",
                          }}
                          onMouseEnter={e => {
                            if (!isSel && !isRevealed) {
                              e.currentTarget.style.borderColor = "#cbd5e1";
                              e.currentTarget.style.background = "#f8fafc";
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isSel && !isRevealed) {
                              e.currentTarget.style.borderColor = optBorder;
                              e.currentTarget.style.background = optBg;
                            }
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{
                              width: 24, height: 24, borderRadius: "50%",
                              border: `1px solid ${badgeBorder}`,
                              background: badgeBg,
                              color: badgeTextColor,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 11, fontWeight: 700, flexShrink: 0,
                            }}>
                              {isRevealed && isRightOpt ? "✓" : isRevealed && isSel && !isRightOpt ? "✕" : opt}
                            </span>
                            <span>{q.options[opt]}</span>
                          </div>

                          {isRevealed && isRightOpt && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", background: "#dcfce7", padding: "2px 8px", borderRadius: 6 }}>
                              Correct
                            </span>
                          )}
                          {isRevealed && isSel && !isRightOpt && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", background: "#fee2e2", padding: "2px 8px", borderRadius: 6 }}>
                              Your Choice
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Clean Explanation Box */}
                  {isRevealed && (
                    <div className="animate-in" style={{
                      padding: "14px 16px", borderRadius: 10,
                      background: isCorrect ? "#f0fdf4" : "#fef2f2",
                      border: `1px solid ${isCorrect ? "#bbf7d0" : "#fca5a5"}`,
                      borderLeft: `4px solid ${isCorrect ? "#16a34a" : "#dc2626"}`,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 12, fontWeight: 700, color: isCorrect ? "#15803d" : "#b91c1c" }}>
                        {isCorrect ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                        {isCorrect ? "Correct answer!" : `Incorrect — Correct answer is Option ${q.correct}`}
                      </div>
                      <p style={{ fontSize: 12.5, color: "#334155", margin: 0, lineHeight: 1.5 }}>
                        {q.explanation}
                      </p>
                    </div>
                  )}

                  {/* Personal Study Note Box */}
                  {commentOpen[q.id] && (
                    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: 8, background: "#f8fafc", padding: 12, borderRadius: 10, border: "1px solid #e2e8f0" }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        My Question Note:
                      </label>
                      <textarea
                        value={comments[q.id] || ""}
                        onChange={event => setComments(previous => ({ ...previous, [q.id]: event.target.value }))}
                        placeholder="Add personal note or memory tip for this question…"
                        rows={2}
                        style={{ width: "100%", boxSizing: "border-box", resize: "vertical", border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontFamily: "inherit", color: "#0f172a" }}
                      />
                      <button
                        onClick={() => saveComment(q.id)}
                        style={{ alignSelf: "flex-start", border: "none", borderRadius: 6, padding: "6px 12px", background: ACCENT, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      >
                        Save note
                      </button>
                    </div>
                  )}

                </div>

                {/* Bottom Action Toolbar */}
                <div style={{ padding: "12px 20px", borderTop: "1px solid #f1f5f9", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, gap: 10 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => toggleExplanation(q.id)}
                      disabled={!userSelected}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        border: `1px solid ${isRevealed ? "#bbf7d0" : "#cbd5e1"}`,
                        borderRadius: 8, padding: "8px 14px",
                        background: isRevealed ? "#f0fdf4" : "#ffffff",
                        color: isRevealed ? "#15803d" : ACCENT,
                        fontSize: 12, fontWeight: 700,
                        cursor: userSelected ? "pointer" : "not-allowed",
                        opacity: userSelected ? 1 : 0.5,
                      }}
                    >
                      <HelpCircle size={14} />
                      {isRevealed ? "Hide Explanation" : "Explain"}
                    </button>

                    <button
                      onClick={() => setCommentOpen(previous => ({ ...previous, [q.id]: !previous[q.id] }))}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 14px", background: "#ffffff", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      <MessageSquare size={14} />
                      {comments[q.id] ? "Edit note" : "Add note"}
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                    <button
                      onClick={() => setCurrentQuestion(previous => Math.max(0, previous - 1))}
                      disabled={currentQuestion === 0}
                      style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 14px", background: "#ffffff", color: "#475569", fontSize: 12, fontWeight: 700, cursor: currentQuestion > 0 ? "pointer" : "not-allowed", opacity: currentQuestion > 0 ? 1 : 0.4 }}
                    >
                      Previous
                    </button>

                    {currentQuestion < activeQuiz.questions.length - 1 ? (
                      <button
                        onClick={() => setCurrentQuestion(previous => previous + 1)}
                        disabled={!userSelected}
                        style={{ border: "none", borderRadius: 8, padding: "8px 16px", background: ACCENT, color: "#ffffff", fontSize: 12, fontWeight: 700, cursor: userSelected ? "pointer" : "not-allowed", opacity: userSelected ? 1 : 0.5 }}
                      >
                        Next →
                      </button>
                    ) : (
                      <button
                        onClick={submitQuiz}
                        disabled={Object.keys(answers).length < activeQuiz.questions.length}
                        style={{ border: "none", borderRadius: 8, padding: "8px 16px", background: "#16a34a", color: "#ffffff", fontSize: 12, fontWeight: 700, cursor: Object.keys(answers).length === activeQuiz.questions.length ? "pointer" : "not-allowed", opacity: Object.keys(answers).length === activeQuiz.questions.length ? 1 : 0.5 }}
                      >
                        Submit Quiz
                      </button>
                    )}
                  </div>
                </div>

              </div>
            );
          })()}

        </div>
      )}

      {/* ── RESULT MODE ── */}
      {mode === "result" && activeQuiz && scoreResult && (
        <div className="quiz-flow-panel" style={{ maxWidth: 880, margin: "0 auto", width: "100%", flex: 1 }}>
          <button onClick={() => setMode("list")} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 13, marginBottom: 20, display: "flex", alignItems: "center", gap: 6, fontWeight: 600, padding: 0 }}>
            ← Back to quizzes
          </button>

          {/* Score Header Card */}
          <div style={{ ...S, textAlign: "center", padding: "36px 28px", marginBottom: 24, position: "relative", overflow: "hidden" }}>
            <Award size={44} color={scoreResult.pct >= 70 ? "#16a34a" : ACCENT} style={{ margin: "0 auto 12px" }} />
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>Quiz Completed!</h2>
            <p style={{ fontSize: 32, fontWeight: 800, color: scoreResult.pct >= 70 ? "#16a34a" : ACCENT, margin: "8px 0 6px" }}>
              {scoreResult.score} / {scoreResult.total} <span style={{ fontSize: 20, color: "#64748b" }}>({scoreResult.pct}%)</span>
            </p>
            <p style={{ fontSize: 13, color: "#64748b", maxWidth: 500, margin: "0 auto" }}>
              {scoreResult.pct >= 80
                ? "Excellent performance! You've mastered this topic."
                : scoreResult.pct >= 60
                ? "Good job! Review the explanations below to sharpen your knowledge."
                : "Keep practicing! Explore the detailed explanations below to understand key concepts."}
            </p>

            <div style={{ marginTop: 20, display: "flex", justifyContent: "center", gap: 12 }}>
              <button
                onClick={() => startQuiz(activeQuiz)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: ACCENT, color: "#ffffff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                <RotateCcw size={14} /> Retake Quiz
              </button>
            </div>
          </div>

          {/* Review Filter Bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
              Question Review
            </h3>
            <div style={{ display: "flex", gap: 6, background: "#ffffff", padding: 4, borderRadius: 8, border: "1px solid #e2e8f0" }}>
              {(["all", "incorrect", "correct"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setResultFilter(f)}
                  style={{
                    border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                    background: resultFilter === f ? ACCENT_LIGHT : "transparent",
                    color: resultFilter === f ? ACCENT : "#64748b",
                    textTransform: "capitalize",
                  }}
                >
                  {f === "all" ? `All (${activeQuiz.questions.length})` : f === "incorrect" ? `Incorrect (${activeQuiz.questions.length - scoreResult.score})` : `Correct (${scoreResult.score})`}
                </button>
              ))}
            </div>
          </div>

          {/* Question Breakdown List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 40 }}>
            {activeQuiz.questions
              .filter(q => {
                const userAns = answers[q.id];
                const isCorrect = userAns === q.correct;
                if (resultFilter === "correct") return isCorrect;
                if (resultFilter === "incorrect") return !isCorrect;
                return true;
              })
              .map((q, idx) => {
                const userAns = answers[q.id];
                const isCorrect = userAns === q.correct;

                return (
                  <div key={q.id} style={{
                    ...S,
                    padding: "20px 22px",
                    borderColor: isCorrect ? "#bbf7d0" : "#fca5a5",
                    background: isCorrect ? "#fafdfb" : "#fffcfc",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                      {isCorrect ? <CheckCircle2 size={20} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} /> : <XCircle size={20} color="#dc2626" style={{ flexShrink: 0, marginTop: 2 }} />}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Question {idx + 1}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: isCorrect ? "#15803d" : "#b91c1c", background: isCorrect ? "#dcfce7" : "#fee2e2", padding: "2px 8px", borderRadius: 6 }}>
                            {isCorrect ? "Correct" : "Needs Review"}
                          </span>
                        </div>
                        <p style={{ fontSize: 14.5, fontWeight: 700, color: "#0f172a", margin: 0, lineHeight: 1.4 }}>
                          {q.question}
                        </p>
                      </div>
                    </div>

                    {/* Options list in review */}
                    <div style={{ paddingLeft: 32, display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                      {(["A", "B", "C", "D"] as const).map(opt => {
                        const isTarget = opt === q.correct;
                        const isUser = opt === userAns;
                        let bg = "#ffffff";
                        let color = "#475569";
                        let weight = 400;
                        let border = "#e2e8f0";

                        if (isTarget) { bg = "#dcfce7"; color = "#15803d"; weight = 600; border = "#bbf7d0"; }
                        else if (isUser && !isCorrect) { bg = "#fee2e2"; color = "#dc2626"; weight = 600; border = "#fca5a5"; }

                        return (
                          <div key={opt} style={{ padding: "8px 12px", borderRadius: 8, background: bg, color, fontSize: 12.5, fontWeight: weight, border: `1px solid ${border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span><strong>{opt}.</strong> {q.options[opt]}</span>
                            <span>
                              {isTarget && <span style={{ fontSize: 11, color: "#15803d", fontWeight: 700 }}>✓ Correct Answer</span>}
                              {isUser && !isCorrect && <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 700, marginLeft: 8 }}>✕ Your Choice</span>}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Clean Explanation Box */}
                    <div style={{ paddingLeft: 32 }}>
                      <div style={{ background: "#ffffff", padding: "12px 16px", borderRadius: 10, border: "1px solid #e2e8f0", borderLeft: `4px solid ${ACCENT}` }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: ACCENT, margin: "0 0 4px" }}>Explanation</p>
                        <p style={{ fontSize: 12.5, color: "#475569", margin: 0, lineHeight: 1.5 }}>
                          {q.explanation}
                        </p>
                      </div>
                    </div>

                    {/* User Note display if exists */}
                    {comments[q.id] && (
                      <div style={{ paddingLeft: 32, marginTop: 10 }}>
                        <div style={{ background: "#f8fafc", padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12, color: "#475569" }}>
                          <strong style={{ color: "#0f172a" }}>My Note:</strong> {comments[q.id]}
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}
          </div>
        </div>
      )}

    </div>
  );
}
