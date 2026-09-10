import { useEffect, useRef, useState } from "react";
import { Bot, Send, FileText, Sparkles, User, CornerDownLeft } from "lucide-react";
import { AxiosError } from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import api from "../api/client";
import CustomSelect from "./CustomSelect";

interface Doc { id: string; filename: string; ai_index_status: string; }
interface Message { role: "user" | "ai"; content: string; }

const ACCENT        = "oklch(45% 0.033 256.848)";
const ACCENT_HOVER  = "oklch(52% 0.04 256.848)";
const ACCENT_LIGHT  = "oklch(96% 0.015 256.848)";

const SUGGESTIONS = [
  "Summarize key takeaways",
  "What are the main topics?",
  "List definitions & rules",
  "Quick document overview",
];

export default function AiChatView() {
  const [docs, setDocs]               = useState<Doc[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [messages, setMessages]       = useState<Message[]>([]);
  const [input, setInput]             = useState("");
  const [loading, setLoading]         = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api.get("/pdf/library").then(({ data }) => setDocs(data)).catch(() => {});
    api.get("/ai/history").then(({ data }) => {
      const history: Message[] = data.flatMap((item: { message: string; answer: string }) => [
        { role: "user", content: item.message },
        { role: "ai", content: item.answer },
      ]);
      setMessages(history);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(query?: string) {
    const q = (query || input).trim();
    if (!q || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: q }]);
    setLoading(true);

    try {
      const { data } = await api.post("/ai/chat", {
        message: q,
        doc_id: selectedDoc?.id || null,
      });
      setMessages(prev => [...prev, { role: "ai", content: data.answer || "No response generated." }]);
    } catch (e: unknown) {
      const msg = e instanceof AxiosError && typeof e.response?.data?.detail === "string"
        ? e.response.data.detail
        : "Could not generate answer. Please try again.";
      setMessages(prev => [...prev, { role: "ai", content: `Error: ${msg}` }]);
    } finally {
      setLoading(false);
    }
  }

  const readyDocs = docs.filter(d => (d.ai_index_status || "ready").toLowerCase() === "ready");

  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 60px)", background: "#f8fafc", fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Top Header Bar ── */}
      <div style={{
        padding: "14px 28px", background: "#ffffff", borderBottom: "1px solid #e2e8f0",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: ACCENT_LIGHT, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Bot size={19} color={ACCENT} />
          </div>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>Ask AI Studio</h1>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Grounded AI assistant for document intelligence & Q&A</p>
          </div>
        </div>

        {/* Target Document Selector */}
        <div style={{ width: 240 }}>
          <CustomSelect
            fullWidth={false}
            placeholder="Search all documents"
            value={selectedDoc?.id || ""}
            options={[
              { value: "", label: "Search all documents", icon: Sparkles },
              ...readyDocs.map(d => ({ value: d.id, label: d.filename, icon: FileText }))
            ]}
            onChange={val => {
              const found = readyDocs.find(d => d.id === val);
              setSelectedDoc(found || null);
            }}
          />
        </div>
      </div>

      {/* ── Main Chat Stream Container (Optimal Centered Reading Column) ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px", display: "flex", flexDirection: "column" }}>
        <div style={{ maxWidth: 820, width: "100%", margin: "0 auto", flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>

          {messages.length === 0 ? (
            <div style={{ margin: "auto", maxWidth: 540, textAlign: "center", padding: "40px 20px" }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: ACCENT_LIGHT, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", boxShadow: "0 4px 12px oklch(45% 0.033 256.848 / 0.15)" }}>
                <Bot size={26} color={ACCENT} />
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>What would you like to explore?</h3>
              <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, marginBottom: 24 }}>
                Ask questions across your uploaded PDF library. Answers are strictly grounded in document text with zero hallucination.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => send(s)} style={{
                    background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10,
                    padding: "11px 14px", textAlign: "left", fontSize: 12.5, fontWeight: 500,
                    color: "#334155", cursor: "pointer", transition: "all 0.15s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.background = ACCENT_LIGHT; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "#ffffff"; e.currentTarget.style.transform = "none"; }}
                  >
                    "{s}"
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} style={{
                display: "flex", gap: 12,
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                alignItems: "flex-start",
              }}>
                {m.role === "ai" && (
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: ACCENT_LIGHT, border: "1px solid rgba(124,58,237,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                    <Bot size={16} color={ACCENT} />
                  </div>
                )}

                <div style={{
                  width: "fit-content",
                  maxWidth: m.role === "user" ? "75%" : "88%",
                  padding: "12px 18px",
                  borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background: m.role === "user" ? ACCENT : "#ffffff",
                  color: m.role === "user" ? "#ffffff" : "#0f172a",
                  fontSize: 13.5, lineHeight: 1.6,
                  boxShadow: m.role === "user" ? "0 3px 10px oklch(45% 0.033 256.848 / 0.2)" : "0 1px 4px rgba(0,0,0,0.05)",
                  border: m.role === "ai" ? "1px solid #e2e8f0" : "none",
                  wordBreak: "break-word",
                }}>
                  {m.role === "ai" ? (
                    <div className="ai-message-markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    m.content
                  )}
                </div>

                {m.role === "user" && (
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                    <User size={15} color="#ffffff" />
                  </div>
                )}
              </div>
            ))
          )}

          {loading && (
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: ACCENT_LIGHT, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Bot size={16} color={ACCENT} />
              </div>
              <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", padding: "10px 16px", borderRadius: 12, display: "flex", alignItems: "center", gap: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid #e2e8f0", borderTopColor: ACCENT }} className="spin" />
                <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>Searching document text & generating grounded response…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Bottom Input Container (Centered Input Bar) ── */}
      <div style={{ padding: "16px 28px", background: "#ffffff", borderTop: "1px solid #e2e8f0", flexShrink: 0 }}>
        <div style={{ maxWidth: 820, margin: "0 auto", width: "100%" }}>
          <form onSubmit={e => { e.preventDefault(); send(); }} style={{ display: "flex", gap: 10, position: "relative", alignItems: "center" }}>
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={selectedDoc ? `Ask a question about "${selectedDoc.filename}"…` : "Ask a question about your uploaded documents…"}
              style={{
                flex: 1, resize: "none", border: "1px solid #cbd5e1", borderRadius: 12,
                padding: "12px 16px", fontSize: 13.5, color: "#0f172a", outline: "none",
                fontFamily: "inherit", background: "#f8fafc", transition: "all 0.15s ease",
                boxShadow: "inset 0 1px 2px rgba(0,0,0,0.02)",
              }}
              onFocus={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.background = "#ffffff"; e.currentTarget.style.boxShadow = "0 0 0 3px oklch(45% 0.033 256.848 / 0.1)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.boxShadow = "none"; }}
            />
            <button
              type="submit" disabled={!input.trim() || loading}
              style={{
                background: ACCENT, color: "#fff", border: "none", borderRadius: 12,
                padding: "0 18px", height: 44, display: "flex", alignItems: "center", justifyContent: "center",
                cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                opacity: input.trim() && !loading ? 1 : 0.5, transition: "all 0.15s ease",
                boxShadow: input.trim() && !loading ? "0 4px 12px oklch(45% 0.033 256.848 / 0.3)" : "none",
                flexShrink: 0,
              }}
              onMouseEnter={e => { if (input.trim() && !loading) e.currentTarget.style.background = ACCENT_HOVER; }}
              onMouseLeave={e => { if (input.trim() && !loading) e.currentTarget.style.background = ACCENT; }}
            >
              <Send size={16} />
            </button>
          </form>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, padding: "0 4px" }}>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>
              DocMind AI reads document embeddings for accurate citations.
            </span>
            <span style={{ fontSize: 11, color: "#94a3b8", display: "inline-flex", alignItems: "center", gap: 3 }}>
              Press <CornerDownLeft size={10} /> Enter to send
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
