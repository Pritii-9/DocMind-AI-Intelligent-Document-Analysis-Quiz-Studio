import { X, LogOut } from "lucide-react";

interface SignOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function SignOutModal({ isOpen, onClose, onConfirm }: SignOutModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs fade-in font-[Inter,system-ui,sans-serif]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl border border-slate-200/80 w-full max-w-sm p-5 relative animate-in"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg p-1 transition-colors cursor-pointer"
        >
          <X size={15} />
        </button>

        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
            <LogOut size={16} className="text-red-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 leading-tight">Sign out of workspace?</h3>
            <p className="text-xs text-slate-500 leading-tight mt-0.5">End your current session</p>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed mb-5">
          You'll need to enter your work credentials to log back in to your hiring workspace.
        </p>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 shadow-xs transition-colors cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
