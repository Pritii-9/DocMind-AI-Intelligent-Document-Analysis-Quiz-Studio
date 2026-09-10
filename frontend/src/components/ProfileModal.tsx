import { useState, useEffect } from "react";
import { User, CheckCircle2, X, Save, Building } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import api from "../api/client";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ACCENT = "oklch(45% 0.033 256.848)";
const ACCENT_LIGHT = "oklch(96% 0.015 256.848)";

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

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 110,
      background: "rgba(15, 23, 42, 0.6)",
      backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}
    onClick={onClose}
    >
      <div
        className="animate-in"
        onClick={e => e.stopPropagation()}
        style={{
          background: "#ffffff",
          borderRadius: 16,
          boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
          border: "1px solid #e2e8f0",
          width: "100%",
          maxWidth: 480,
          overflow: "hidden",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: "18px 24px",
          borderBottom: "1px solid #f1f5f9",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "#f8fafc",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: ACCENT_LIGHT, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <User size={18} color={ACCENT} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: 0 }}>Account Settings</h3>
              <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>Manage your display name and view account details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, padding: 5, cursor: "pointer", color: "#64748b", display: "flex" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* User Profile Card */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#f8fafc", padding: 14, borderRadius: 12, border: "1px solid #e2e8f0" }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: ACCENT,
              color: "#ffffff", fontSize: 18, fontWeight: 800,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 10px oklch(45% 0.033 256.848 / 0.25)",
            }}>
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{user?.name}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                  background: user?.role === "admin" ? "#f0fdf4" : ACCENT_LIGHT,
                  color: user?.role === "admin" ? "#15803d" : ACCENT,
                  border: `1px solid ${user?.role === "admin" ? "#bbf7d0" : "oklch(85% 0.03 256.848)"}`,
                  padding: "2px 8px", borderRadius: 99,
                }}>
                  {user?.role}
                </span>
              </div>
              <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>{userDetails?.email || "Workspace Member"}</p>
            </div>
          </div>

          {/* Edit Display Name */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", marginBottom: 6 }}>
              Display Name
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter your name"
                style={{
                  flex: 1, border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 12px",
                  fontSize: 13, color: "#0f172a", outline: "none", background: "#ffffff",
                }}
              />
              <button
                onClick={handleSaveName}
                disabled={saving || name.trim() === user?.name}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: ACCENT, color: "#ffffff", border: "none", borderRadius: 8,
                  padding: "9px 14px", fontSize: 12, fontWeight: 700,
                  cursor: saving || name.trim() === user?.name ? "not-allowed" : "pointer",
                  opacity: saving || name.trim() === user?.name ? 0.5 : 1,
                }}
              >
                <Save size={13} /> {saving ? "Saving…" : "Save Name"}
              </button>
            </div>
          </div>

          {/* Account Overview */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", marginBottom: 10 }}>
              Account Overview
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: 12, color: "#475569", display: "flex", alignItems: "center", gap: 6 }}>
                  <Building size={14} color="#64748b" /> Workspace Owner
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>
                  {user?.workspace_owner || "Personal Workspace"}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: 12, color: "#475569", display: "flex", alignItems: "center", gap: 6 }}>
                  <CheckCircle2 size={14} color="#16a34a" /> Account Status
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#15803d", background: "#dcfce7", padding: "2px 8px", borderRadius: 6 }}>
                  Active & Verified
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div style={{
          padding: "14px 24px",
          background: "#f8fafc",
          borderTop: "1px solid #f1f5f9",
          display: "flex", justifyContent: "flex-end",
        }}>
          <button
            onClick={onClose}
            style={{
              border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 16px",
              background: "#ffffff", color: "#475569", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
