import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
}

interface ToastContextType {
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    warning: (msg: string) => void;
    info: (msg: string) => void;
  };
  confirm: (options: ConfirmOptions) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const ACCENT = "oklch(45% 0.033 256.848)";

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmModal, setConfirmModal] = useState<ConfirmOptions | null>(null);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    setConfirmModal(options);
  }, []);

  const toast = {
    success: (msg: string) => addToast(msg, "success"),
    error:   (msg: string) => addToast(msg, "error"),
    warning: (msg: string) => addToast(msg, "warning"),
    info:    (msg: string) => addToast(msg, "info"),
  };

  return (
    <ToastContext.Provider value={{ toast, confirm }}>
      {children}

      {/* ── Toast Container ──────────────────────────────────────────────── */}
      <div style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 9999,
        display: "flex", flexDirection: "column", gap: 10, maxWidth: 380, width: "100%",
        pointerEvents: "none",
      }}>
        {toasts.map(t => {
          const config = {
            success: { bg: "#ffffff", border: "#86efac", color: "#15803d", icon: CheckCircle2, iconColor: "#16a34a" },
            error:   { bg: "#ffffff", border: "#fca5a5", color: "#dc2626", icon: XCircle,      iconColor: "#dc2626" },
            warning: { bg: "#ffffff", border: "#fde047", color: "#a16207", icon: AlertTriangle, iconColor: "#d97706" },
            info:    { bg: "#ffffff", border: "oklch(85% 0.03 256.848)", color: "#0f172a", icon: Info, iconColor: ACCENT },
          }[t.type];

          const Icon = config.icon;

          return (
            <div key={t.id} className="slide-in" style={{
              pointerEvents: "auto",
              background: config.bg,
              border: `1px solid ${config.border}`,
              borderRadius: 12,
              padding: "12px 16px",
              boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)",
              display: "flex", alignItems: "center", gap: 12,
              color: config.color,
            }}>
              <Icon size={18} color={config.iconColor} style={{ flexShrink: 0 }} />
              <p style={{ fontSize: 13, fontWeight: 600, flex: 1, margin: 0, lineHeight: 1.4 }}>{t.message}</p>
              <button
                onClick={() => removeToast(t.id)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 2, display: "flex" }}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Confirmation Modal ────────────────────────────────────────────── */}
      {confirmModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10000,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20,
        }} className="fade-in">
          <div style={{
            background: "#ffffff",
            borderRadius: 16,
            boxShadow: "0 20px 40px -15px rgba(0,0,0,0.2)",
            border: "1px solid #e2e8f0",
            maxWidth: 420, width: "100%", padding: 24,
          }} className="animate-in">
            <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", margin: "0 0 8px 0" }}>
              {confirmModal.title}
            </h3>
            <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, margin: "0 0 24px 0" }}>
              {confirmModal.message}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setConfirmModal(null)}
                style={{
                  background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10,
                  padding: "9px 18px", fontSize: 13, fontWeight: 600, color: "#64748b",
                  cursor: "pointer", transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.color = "#0f172a"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#64748b"; }}
              >
                {confirmModal.cancelText || "Cancel"}
              </button>
              <button
                onClick={() => {
                  const fn = confirmModal.onConfirm;
                  setConfirmModal(null);
                  fn();
                }}
                style={{
                  background: confirmModal.danger ? "#dc2626" : ACCENT,
                  border: "none", borderRadius: 10,
                  padding: "9px 20px", fontSize: 13, fontWeight: 600, color: "#ffffff",
                  cursor: "pointer",
                  boxShadow: confirmModal.danger
                    ? "0 4px 12px rgba(220,38,38,0.25)"
                    : "0 4px 14px oklch(45% 0.033 256.848 / 0.35)",
                  transition: "all 0.15s",
                }}
              >
                {confirmModal.confirmText || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
