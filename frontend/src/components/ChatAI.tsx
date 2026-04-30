import { useState, useRef, useEffect, useCallback, type ChangeEvent, type KeyboardEvent } from "react";
import { Send, Loader2, X, Bot, Sparkles, RotateCcw, Copy, Check } from "lucide-react";
import { aiQuery, type AIQueryRequest, API_BASE_URL } from "../api/axios";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  loading?: boolean;
  isStreaming?: boolean;
}

interface ChatAIProps {
  docKey?: string;
  title?: string;
  className?: string;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-[var(--accent)] opacity-60"
          style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
      <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }`}</style>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-[var(--workspace-hover)] text-[var(--text-soft)] hover:text-[var(--text-strong)]"
      title="Copy message"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

export default function ChatAI({ docKey, title, className = "" }: ChatAIProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadIdRef = useRef(Math.random().toString(36).substring(2, 11));

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    setMessages([]);
    setStatusMessage(null);
  }, [docKey]);

  // Auto-resize textarea
  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setIsLoading(true);
    setStatusMessage(docKey ? "Searching indexed PDF..." : "Thinking...");

    const optimisticBotId = `bot-${Date.now()}`;
    const optimisticBot: Message = {
      id: optimisticBotId,
      role: "assistant",
      content: "",
      loading: true,
    };
    setMessages((prev) => [...prev, optimisticBot]);

    try {
      if (docKey) {
        const data: AIQueryRequest = { question: userMsg.content, doc_key: docKey };
        const response = await aiQuery(data);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === optimisticBotId
              ? { ...msg, content: response.answer, loading: false }
              : msg
          )
        );
      } else {
        const token = localStorage.getItem("access_token");
        const response = await fetch(`${API_BASE_URL}/ai/chat/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ query: userMsg.content, thread_id: threadIdRef.current }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData?.msg || "Stream request failed");
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder("utf-8");

        // Mark as streaming (remove loading spinner)
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === optimisticBotId
              ? { ...msg, content: "", loading: false, isStreaming: true }
              : msg
          )
        );
        setStatusMessage(null);

        let currentContent = "";
        let buffer = "";

        while (reader) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            if (part.startsWith("data: ")) {
              const dataStr = part.slice(6).trim();
              if (dataStr === "[DONE]") break;
              try {
                const parsed = JSON.parse(dataStr);
                if (typeof parsed.content === "string" && parsed.content) {
                  currentContent += parsed.content;
                  const snapshot = currentContent;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === optimisticBotId
                        ? { ...msg, content: snapshot }
                        : msg
                    )
                  );
                }
              } catch {
                // partial chunk — ignore
              }
            }
          }
        }

        // Mark streaming done
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === optimisticBotId
              ? { ...msg, isStreaming: false }
              : msg
          )
        );
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Something went wrong.";
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === optimisticBotId
            ? { ...msg, content: `⚠️ ${errMsg}`, loading: false, isStreaming: false }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      setStatusMessage(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    threadIdRef.current = Math.random().toString(36).substring(2, 11);
  };

  const suggestions = docKey
    ? ["Summarize this document", "What are the key points?", "List the main topics"]
    : ["How many documents do we have?", "Show recent uploads", "What's in my workspace?"];

  return (
    <div
      className={`flex flex-col rounded-3xl border border-[var(--workspace-border)] bg-[var(--panel-solid)] shadow-2xl shadow-black/10 overflow-hidden ${className}`}
      style={{ minHeight: 400 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--workspace-divider)] bg-[var(--workspace-frame)] px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-purple-500 shadow-sm">
            <Bot size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--text-strong)] leading-none">{title || "AI Assistant"}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-soft)]">
              {docKey ? "RAG · Document Mode" : "LangGraph · Agent Mode"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {isLoading && (
            <span className="flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
              Live
            </span>
          )}
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="rounded-xl p-2 text-[var(--text-soft)] transition-all hover:bg-[var(--workspace-hover)] hover:text-[var(--text-strong)]"
              title="New conversation"
            >
              <RotateCcw size={15} />
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="rounded-xl p-2 text-[var(--text-soft)] transition-all hover:bg-rose-500/10 hover:text-rose-500"
              title="Clear chat"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scroll-smooth" style={{ minHeight: 0 }}>
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-8 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--accent)]/20 to-purple-500/20 ring-1 ring-[var(--accent)]/20">
              <Sparkles size={26} className="text-[var(--accent)]" />
            </div>
            <p className="font-bold text-[var(--text-strong)]">
              {docKey ? "Ask about this document" : "Ask your workspace AI"}
            </p>
            <p className="mt-1 text-sm text-[var(--text-soft)]">
              {docKey ? "I'll search the indexed content to answer" : "I can query docs, analytics, and team data"}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); inputRef.current?.focus(); }}
                  className="rounded-xl border border-[var(--workspace-border)] bg-[var(--panel)] px-3 py-1.5 text-xs font-medium text-[var(--text-soft)] transition-all hover:border-[var(--accent)]/50 hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`group flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              {msg.role === "assistant" && (
                <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-purple-500 shadow-sm">
                  <Bot size={13} className="text-white" />
                </div>
              )}
              <div
                className={`relative max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "rounded-tr-sm bg-gradient-to-br from-[var(--accent)] to-purple-600 text-white shadow-md shadow-[var(--accent)]/20"
                    : "rounded-tl-sm border border-[var(--workspace-border)] bg-[var(--panel)] text-[var(--text-strong)]"
                }`}
              >
                {msg.loading ? (
                  <TypingIndicator />
                ) : (
                  <>
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    {msg.isStreaming && (
                      <span className="ml-1 inline-block h-4 w-0.5 animate-pulse rounded-full bg-[var(--accent)]" />
                    )}
                  </>
                )}
                {!msg.loading && msg.role === "assistant" && msg.content && (
                  <div className="absolute -right-7 top-2">
                    <CopyButton text={msg.content} />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--workspace-divider)] bg-[var(--workspace-frame)] px-4 pb-4 pt-3">
        {statusMessage && (
          <div className="mb-2 flex items-center gap-2 text-xs text-[var(--text-soft)]">
            <Loader2 size={11} className="animate-spin" />
            {statusMessage}
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={docKey ? "Ask about this PDF..." : "Ask anything about your workspace..."}
              className="w-full resize-none rounded-2xl border border-[var(--workspace-border)] bg-[var(--workspace-input)] px-4 py-3 pr-4 text-sm text-[var(--text-strong)] outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 placeholder:text-[var(--text-soft)]"
              disabled={isLoading}
              rows={1}
              style={{ maxHeight: 120 }}
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="mb-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--accent)] to-purple-600 text-white shadow-md shadow-[var(--accent)]/30 transition-all hover:shadow-lg hover:shadow-[var(--accent)]/40 hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none"
            aria-label="Send message"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-[var(--text-soft)]/60">
          {docKey ? "Powered by RAG · Sources cited from indexed PDF" : "Powered by LangGraph · Memory-aware agent · Streaming"}
        </p>
      </div>
    </div>
  );
}
