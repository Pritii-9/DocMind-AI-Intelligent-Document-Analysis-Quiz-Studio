import { useState, useEffect } from "react";
import { User, CheckCircle2, X, Save, Building } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import api from "../api/client";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);
  const [userDetails, setUserDetails] = useState<{ email?: string; created_at?: string; verified?: boolean } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(user?.name || "");
      api.get("/auth/me").then(({ data }) => setUserDetails(data)).catch(() => {});
    }
  }, [isOpen, user?.name]);

  if (!isOpen) return null;

  async function handleSaveName() {
    const trimmed = name.trim();
    if (!trimmed) return toast.error("Name cannot be empty");
    setSaving(true);
    try {
      await api.patch("/auth/update-profile", { name: trimmed });
      updateUser(trimmed);
      toast.success("Profile updated successfully!");
    } catch (e: any) {
      toast.error(e.response?.data?.detail || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  const isUnchanged = name.trim() === user?.name;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-[480px] overflow-hidden animate-in font-[Inter,system-ui,sans-serif]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-[18px] border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center" style={{ background: "var(--brand-light)" }}>
              <User size={18} style={{ color: "var(--brand)" }} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 m-0">Account Settings</h3>
              <p className="text-[11px] text-slate-500 m-0">Manage your display name and account details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center bg-slate-100 border border-slate-200 rounded-lg p-1.5 cursor-pointer text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4">

          {/* Avatar card */}
          <div className="flex items-center gap-3.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-[18px] font-extrabold shrink-0"
              style={{ background: "var(--brand)", boxShadow: "0 4px 10px rgba(61,79,110,0.25)" }}
            >
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-extrabold text-slate-900">{user?.name}</span>
                <span
                  className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                  style={
                    user?.role === "admin"
                      ? { background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0" }
                      : { background: "var(--brand-light)", color: "var(--brand)", border: "1px solid var(--brand-border)" }
                  }
                >
                  {user?.role}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{userDetails?.email || "Workspace Member"}</p>
            </div>
          </div>

          {/* Edit name */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-slate-500 mb-1.5">
              Display Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter your name"
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-[13px] text-slate-900 outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 bg-white transition-colors"
              />
              <button
                onClick={handleSaveName}
                disabled={saving || isUnchanged}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white rounded-lg transition-opacity cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: "var(--brand)" }}
              >
                <Save size={12} /> {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          {/* Account overview */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-slate-500 mb-2.5">
              Account Overview
            </p>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Building size={13} className="text-slate-400" /> Workspace Owner
                </span>
                <span className="text-xs font-semibold text-slate-800">
                  {user?.workspace_owner || "Personal Workspace"}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-xs text-slate-500 flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-green-600" /> Account Status
                </span>
                <span className="text-[11px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-md">
                  Active &amp; Verified
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="border border-slate-300 rounded-lg px-4 py-2 bg-white text-slate-600 text-xs font-bold cursor-pointer hover:border-slate-400 hover:text-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
