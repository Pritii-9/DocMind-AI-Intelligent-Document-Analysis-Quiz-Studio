import { useEffect, useRef, useState } from "react";
import { Bot, Send, FileText, Sparkles, User, CornerDownLeft } from "lucide-react";
import { AxiosError } from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import api from "../api/client";
import CustomSelect from "./CustomSelect";

interface Doc { id: string; filename: string; ai_index_status: string; }
interface Message { role: "user" | "ai"; content: string; }

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
        { role: "ai",   content: item.answer  },
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
      const { data } = await api.post("/ai/chat", { message: q, doc_id: selectedDoc?.id || null });
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
    <div className="animate-in flex flex-col bg-slate-50 font-[Inter,system-ui,sans-serif]" style={{ height: "calc(100vh - 60px)" }}>

      {/* Top header */}
      <div className="px-7 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: "var(--brand-light)" }}>
            <Bot size={19} style={{ color: "var(--brand)" }} />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-900 tracking-[-0.01em] leading-none">Ask AI Studio</h1>
            <p className="text-xs text-slate-500 mt-0.5">Grounded AI assistant for document intelligence &amp; Q&amp;A</p>
          </div>
        </div>
        <div className="w-60">
          <CustomSelect
            fullWidth={false}
            placeholder="Search all documents"
            value={selectedDoc?.id || ""}
            options={[
              { value: "", label: "Search all documents", icon: Sparkles },
              ...readyDocs.map(d => ({ value: d.id, label: d.filename, icon: FileText })),
            ]}
            onChange={val => { const found = readyDocs.find(d => d.id === val); setSelectedDoc(found || null); }}
          />
        </div>
      </div>

      {/* Chat stream */}
      <div className="flex-1 overflow-y-auto px-7 py-6 flex flex-col">
        <div className="max-w-[820px] w-full mx-auto flex-1 flex flex-col gap-[18px]">

          {messages.length === 0 ? (
            <div className="m-auto max-w-[540px] text-center px-5 py-10">
              <div
                className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "var(--brand-light)", boxShadow: "0 4px 12px rgba(61,79,110,0.15)" }}
              >
                <Bot size={26} style={{ color: "var(--brand)" }} />
              </div>
              <h3 className="text-[19px] font-extrabold text-slate-900 mb-1.5">What would you like to explore?</h3>
              <p className="text-[13px] text-slate-500 leading-relaxed mb-6">
                Ask questions across your uploaded PDF library. Answers are grounded in document text with zero hallucination.
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-left text-[12.5px] font-medium text-slate-600 cursor-pointer shadow-sm transition-all duration-150 hover:border-[var(--brand)] hover:bg-[var(--brand-light)] hover:-translate-y-px"
                  >
                    "{s}"
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-3 items-start ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "ai" && (
                  <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 mt-0.5 border border-slate-200" style={{ background: "var(--brand-light)" }}>
                    <Bot size={16} style={{ color: "var(--brand)" }} />
                  </div>
                )}
                <div
                  className={[
                    "w-fit text-[13.5px] leading-relaxed px-[18px] py-3 break-words",
                    m.role === "user"
                      ? "text-white rounded-[16px_16px_4px_16px] max-w-[75%]"
                      : "text-slate-900 bg-white border border-slate-200 rounded-[16px_16px_16px_4px] max-w-[88%] shadow-sm",
                  ].join(" ")}
                  style={
                    m.role === "user"
                      ? { background: "var(--brand)", boxShadow: "0 3px 10px rgba(61,79,110,0.2)" }
                      : undefined
                  }
                >
                  {m.role === "ai" ? (
                    <div className="ai-message-markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                  ) : m.content}
                </div>
                {m.role === "user" && (
                  <div className="w-8 h-8 rounded-[10px] bg-slate-900 flex items-center justify-center shrink-0 mt-0.5">
                    <User size={15} className="text-white" />
                  </div>
                )}
              </div>
            ))
          )}

          {loading && (
            <div className="flex gap-3 items-center">
              <div className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ background: "var(--brand-light)" }}>
                <Bot size={16} style={{ color: "var(--brand)" }} />
              </div>
              <div className="bg-white border border-slate-200 px-4 py-2.5 rounded-xl flex items-center gap-2.5 shadow-sm">
                <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-200 border-t-[var(--brand)] spin" />
                <span className="text-[13px] text-slate-500 font-medium">Searching document text &amp; generating grounded response…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="px-7 py-4 bg-white border-t border-slate-200 shrink-0">
        <div className="max-w-[820px] mx-auto w-full">
          <form onSubmit={e => { e.preventDefault(); send(); }} className="flex gap-2.5 items-center">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={selectedDoc ? `Ask a question about "${selectedDoc.filename}"…` : "Ask a question about your uploaded documents…"}
              className="flex-1 resize-none border border-slate-300 rounded-xl px-4 py-3 text-[13.5px] text-slate-900 outline-none bg-slate-50 font-[inherit] transition-all duration-150 focus:border-[var(--brand)] focus:bg-white focus:ring-[3px] focus:ring-[var(--brand)]/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="flex items-center justify-center h-11 px-[18px] rounded-xl border-none text-white cursor-pointer shrink-0 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "var(--brand)",
                boxShadow: input.trim() && !loading ? "0 4px 12px rgba(61,79,110,0.3)" : "none",
              }}
              onMouseEnter={e => { if (input.trim() && !loading) e.currentTarget.style.background = "var(--brand-hover)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--brand)"; }}
            >
              <Send size={16} />
            </button>
          </form>
          <div className="flex justify-between items-center mt-1.5 px-1">
            <span className="text-[11px] text-slate-400">DocMind AI reads document embeddings for accurate citations.</span>
            <span className="text-[11px] text-slate-400 inline-flex items-center gap-1">
              Press <CornerDownLeft size={10} /> Enter to send
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
