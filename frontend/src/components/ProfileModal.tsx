import { useState, useEffect } from "react";
import { User, CheckCircle2, X, Save, Building, Settings } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useCompany } from "../context/CompanyContext";
import api from "../api/client";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToSettings?: () => void;
}

export default function ProfileModal({ isOpen, onClose, onNavigateToSettings }: ProfileModalProps) {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const { branding } = useCompany();

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
      toast.success("Profile name updated successfully!");
    } catch (e: any) {
      toast.error(e.response?.data?.detail || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  const isUnchanged = name.trim() === user?.name;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs fade-in font-[Inter,system-ui,sans-serif]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl border border-slate-200/80 w-full max-w-[420px] overflow-hidden animate-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <User size={16} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 leading-tight">Recruiter Profile</h3>
              <p className="text-xs text-slate-500 leading-tight mt-0.5">Manage your personal credentials &amp; session</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg p-1 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">
          {/* User badge card */}
          <div className="flex items-center gap-3.5 bg-slate-50 p-3.5 rounded-lg border border-slate-200/70">
            <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-xs">
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900 truncate">{user?.name}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
                  {user?.role || "Recruiter"}
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5">{userDetails?.email || "Workspace Member"}</p>
            </div>
          </div>

          {/* Edit display name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Display Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter your name"
                className="flex-1 h-9 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white transition-colors"
              />
              <button
                onClick={handleSaveName}
                disabled={saving || isUnchanged}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save size={12} /> {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          {/* Account Overview */}
          <div>
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Account Overview
            </p>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/70">
                <span className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Building size={13} className="text-slate-400" /> Organization
                </span>
                <span className="text-xs font-medium text-slate-900 truncate">
                  {branding.name}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/70">
                <span className="text-xs text-slate-500 flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-600" /> Status
                </span>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  Active &amp; Verified
                </span>
              </div>
            </div>
          </div>

          {/* Direct link to Workspace Settings */}
          {onNavigateToSettings && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateToSettings();
              }}
              className="flex items-center justify-between p-3 rounded-lg bg-indigo-50/60 hover:bg-indigo-50 border border-indigo-100 text-left transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <Settings size={15} className="text-indigo-600" />
                <div>
                  <p className="text-xs font-semibold text-slate-900 group-hover:text-indigo-950">
                    Workspace &amp; Company Branding
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Customize logo, company name, and application portal
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                →
              </span>
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="border border-slate-200 rounded-lg px-3.5 py-1.5 bg-white text-slate-700 text-xs font-medium cursor-pointer hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
