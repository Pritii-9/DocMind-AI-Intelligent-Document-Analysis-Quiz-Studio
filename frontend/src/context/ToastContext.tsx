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
    success: { icon: CheckCircle2,  iconCls: "text-emerald-600" },
    error:   { icon: XCircle,       iconCls: "text-red-600"     },
    warning: { icon: AlertTriangle, iconCls: "text-amber-500"   },
    info:    { icon: Info,          iconCls: "text-indigo-600"  },
  };

  return (
    <ToastContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Floating Toast stack */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-[360px] w-full pointer-events-none font-[Inter,system-ui,sans-serif]">
        {toasts.map(t => {
          const cfg = toastConfig[t.type];
          const Icon = cfg.icon;
          return (
            <div
              key={t.id}
              className="slide-in pointer-events-auto bg-white border border-slate-200/80 rounded-xl px-3.5 py-3 shadow-lg shadow-slate-200/50 flex items-center gap-3"
            >
              <Icon size={16} className={`${cfg.iconCls} shrink-0`} />
              <p className="text-xs font-medium text-slate-800 flex-1 m-0 leading-snug">{t.message}</p>
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
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs fade-in font-[Inter,system-ui,sans-serif]">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200/80 max-w-sm w-full p-5 animate-in">
            <h3 className="text-sm font-semibold text-slate-900 mb-1.5">{confirmModal.title}</h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-5">{confirmModal.message}</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmModal(null)}
                className="bg-white border border-slate-200 rounded-lg px-3.5 py-1.5 text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors"
              >
                {confirmModal.cancelText || "Cancel"}
              </button>
              <button
                onClick={() => { const fn = confirmModal.onConfirm; setConfirmModal(null); fn(); }}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white cursor-pointer transition-colors shadow-xs ${
                  confirmModal.danger
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-slate-900 hover:bg-slate-800"
                }`}
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
