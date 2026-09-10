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
    error:   (msg: string) => void;
    warning: (msg: string) => void;
    info:    (msg: string) => void;
  };
  confirm: (options: ConfirmOptions) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts]           = useState<ToastItem[]>([]);
  const [confirmModal, setConfirmModal] = useState<ConfirmOptions | null>(null);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
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

  const toastConfig = {
    success: { borderCls: "border-green-300",  textCls: "text-green-700",  icon: CheckCircle2,  iconCls: "text-green-600"  },
    error:   { borderCls: "border-red-300",    textCls: "text-red-700",    icon: XCircle,       iconCls: "text-red-600"    },
    warning: { borderCls: "border-yellow-300", textCls: "text-amber-700",  icon: AlertTriangle, iconCls: "text-amber-500"  },
    info:    { borderCls: "border-[var(--brand-border)]", textCls: "text-slate-900", icon: Info, iconCls: "text-[var(--brand)]" },
  };

  return (
    <ToastContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toast stack */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5 max-w-[380px] w-full pointer-events-none">
        {toasts.map(t => {
          const cfg = toastConfig[t.type];
          const Icon = cfg.icon;
          return (
            <div
              key={t.id}
              className={`slide-in pointer-events-auto bg-white border ${cfg.borderCls} rounded-xl px-4 py-3 shadow-lg flex items-center gap-3`}
            >
              <Icon size={18} className={`${cfg.iconCls} shrink-0`} />
              <p className={`text-[13px] font-semibold flex-1 m-0 leading-snug ${cfg.textCls}`}>{t.message}</p>
              <button
                onClick={() => removeToast(t.id)}
                className="bg-transparent border-none cursor-pointer text-slate-400 hover:text-slate-600 flex p-0.5 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirm modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-5 bg-slate-900/60 backdrop-blur-md fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-[420px] w-full p-6 animate-in">
            <h3 className="text-[17px] font-extrabold text-slate-900 mb-2">{confirmModal.title}</h3>
            <p className="text-[13px] text-slate-500 leading-relaxed mb-6">{confirmModal.message}</p>
            <div className="flex gap-2.5 justify-end">
              <button
                onClick={() => setConfirmModal(null)}
                className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-[13px] font-semibold text-slate-500 cursor-pointer hover:border-slate-400 hover:text-slate-800 transition-colors"
              >
                {confirmModal.cancelText || "Cancel"}
              </button>
              <button
                onClick={() => { const fn = confirmModal.onConfirm; setConfirmModal(null); fn(); }}
                className={`border-none rounded-xl px-5 py-2 text-[13px] font-semibold text-white cursor-pointer transition-all ${
                  confirmModal.danger
                    ? "bg-red-600 hover:bg-red-700 shadow-sm shadow-red-200"
                    : "hover:opacity-90"
                }`}
                style={confirmModal.danger ? undefined : {
                  background: "var(--brand)",
                  boxShadow: "0 4px 14px rgba(61,79,110,0.35)",
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
