import { useEffect, useRef, useState } from "react";
import { Bot, Send, FileText, Sparkles } from "lucide-react";
import { AxiosError } from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import api from "../api/client";
import CustomSelect from "./CustomSelect";

interface Doc { id: string; filename: string; ai_index_status: string; }
interface Message { role: "user" | "ai"; content: string; }

const ACCENT        = "oklch(45% 0.033 256.848)";
const ACCENT_LIGHT  = "oklch(96% 0.015 256.848)";

const SUGGESTIONS = [
  "Summarize the key takeaways",
  "What are the main topics covered?",
  "List important definitions and rules",
  "Give a quick overview of the file",
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

      {/* Header bar */}
      <div style={{
        padding: "16px 28px", background: "#ffffff", borderBottom: "1px solid #e2e8f0",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: ACCENT_LIGHT, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Bot size={18} color={ACCENT} />
          </div>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: 0 }}>Ask AI</h1>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Ask questions across your library or target a specific PDF</p>
          </div>
        </div>

        {/* Doc selector */}
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

      {/* Chat Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
        {messages.length === 0 ? (
          <div style={{ margin: "auto", maxWidth: 520, textAlign: "center", padding: "40px 20px" }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: ACCENT_LIGHT, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Bot size={24} color={ACCENT} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>What would you like to know?</h3>
            <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, marginBottom: 24 }}>
              Ask anything about your uploaded files. DocMind searches the document text and gives clear answers with citations.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)} style={{
                  background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10,
                  padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 500,
                  color: "#334155", cursor: "pointer", transition: "all 0.15s",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.background = ACCENT_LIGHT; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "#ffffff"; }}
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
            }}>
              {m.role === "ai" && (
                <div style={{ width: 30, height: 30, borderRadius: 8, background: ACCENT_LIGHT, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                  <Bot size={15} color={ACCENT} />
                </div>
              )}
              <div style={{
                maxWidth: "75%",
                padding: "12px 16px",
                borderRadius: m.role === "user" ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                background: m.role === "user" ? ACCENT : "#ffffff",
                color: m.role === "user" ? "#ffffff" : "#0f172a",
                fontSize: 13.5, lineHeight: 1.6,
                boxShadow: m.role === "user" ? "0 2px 8px oklch(45% 0.033 256.848 / 0.25)" : "0 1px 3px rgba(0,0,0,0.06)",
                border: m.role === "ai" ? "1px solid #e2e8f0" : "none",
                whiteSpace: "pre-wrap",
              }}>
                {m.role === "ai" ? (
                  <div className="ai-message-markdown">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: ACCENT_LIGHT, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bot size={15} color={ACCENT} />
            </div>
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", padding: "10px 16px", borderRadius: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: ACCENT }} className="spin" />
              <span style={{ fontSize: 13, color: "#64748b" }}>Searching document text…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input box */}
      <div style={{ padding: "16px 28px", background: "#ffffff", borderTop: "1px solid #e2e8f0", flexShrink: 0 }}>
        <form onSubmit={e => { e.preventDefault(); send(); }} style={{ display: "flex", gap: 10, position: "relative" }}>
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={selectedDoc ? `Ask a question about "${selectedDoc.filename}"…` : "Ask a question about your files…"}
            style={{
              flex: 1, resize: "none", border: "1px solid #cbd5e1", borderRadius: 10,
              padding: "12px 14px", fontSize: 13.5, color: "#0f172a", outline: "none",
              fontFamily: "inherit", background: "#f8fafc", transition: "all 0.15s",
            }}
            onFocus={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.background = "#ffffff"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.background = "#f8fafc"; }}
          />
          <button
            type="submit" disabled={!input.trim() || loading}
            style={{
              background: ACCENT, color: "#fff", border: "none", borderRadius: 10,
              padding: "0 18px", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: input.trim() && !loading ? "pointer" : "not-allowed",
              opacity: input.trim() && !loading ? 1 : 0.5, transition: "all 0.15s",
            }}
          >
            <Send size={16} />
          </button>
        </form>
      </div>

    </div>
  );
}
