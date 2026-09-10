import { useEffect, useState } from "react";
import { UserPlus, UserCheck, UserX } from "lucide-react";
import api from "../api/client";
import { useToast } from "../context/ToastContext";

interface Member {
  _id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  verified?: boolean;
  created_at?: string;
}

const ACCENT        = "oklch(45% 0.033 256.848)";
const ACCENT_HOVER  = "oklch(52% 0.04 256.848)";
const ACCENT_LIGHT  = "oklch(96% 0.015 256.848)";

const fmtD = (s?: string) => s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Active";

const card: React.CSSProperties = {
  background: "#ffffff", borderRadius: 14,
  boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.03)",
  border: "1px solid #e2e8f0",
};

export default function TeamView() {
  const { toast }                     = useToast();
  const [members, setMembers]         = useState<Member[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showInvite, setShowInvite]   = useState(false);
  const [inviteName, setInviteName]   = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting]       = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/auth/users")
      .then(r => setMembers(r.data))
      .catch((err) => {
        toast.error(err.response?.data?.detail || "Failed to load team members.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) return;
    setInviting(true);
    try {
      await api.post("/auth/invite-member", { name: inviteName.trim(), email: inviteEmail.trim() });
      toast.success(`Invite dispatched to ${inviteEmail}`);
      setShowInvite(false);
      setInviteName("");
      setInviteEmail("");
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to send invitation.");
    } finally {
      setInviting(false);
    }
  }

  async function toggleStatus(m: Member) {
    try {
      await api.post(`/auth/users/${m._id}/status`);
      toast.success(`${m.name} status updated.`);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to update member status.");
    }
  }

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "80vh", gap: 12 }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #e2e8f0", borderTopColor: ACCENT }} className="spin" />
      <p style={{ fontSize: 13, color: "#64748b" }}>Loading workspace team…</p>
    </div>
  );

  return (
    <div className="animate-in" style={{ padding: "28px 32px", background: "#f8fafc", minHeight: "calc(100vh - 60px)", fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: "#0f172a" }}>Team Management</h1>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>Manage workspace accounts, roles, and member invitations.</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: ACCENT, color: "#fff", border: "none",
            borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 600,
            cursor: "pointer", boxShadow: "0 4px 14px oklch(45% 0.033 256.848 / 0.3)", transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = ACCENT_HOVER; e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = ACCENT; e.currentTarget.style.transform = "none"; }}
        >
          <UserPlus size={15} /> Invite member
        </button>
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ ...card, width: "100%", maxWidth: 420, padding: 24, position: "relative" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Invite team member</h3>
            <p style={{ fontSize: 12, color: "#64748b", marginBottom: 20 }}>An onboarding email invitation code will be sent to their address.</p>

            <form onSubmit={sendInvite}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", display: "block", marginBottom: 6 }}>Full Name</label>
                <input
                  type="text" required placeholder="Aarav Mehta"
                  value={inviteName} onChange={e => setInviteName(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, color: "#0f172a", outline: "none" }}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", display: "block", marginBottom: 6 }}>Work Email</label>
                <input
                  type="email" required placeholder="aarav@company.com"
                  value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, color: "#0f172a", outline: "none" }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowInvite(false)} style={{ background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, color: "#475569", cursor: "pointer" }}>
                  Cancel
                </button>
                <button type="submit" disabled={inviting} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: inviting ? "not-allowed" : "pointer", opacity: inviting ? 0.7 : 1 }}>
                  {inviting ? "Sending…" : "Send invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Active Members Table */}
      <div style={card}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 120px 140px 110px", padding: "12px 20px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc", borderRadius: "14px 14px 0 0" }}>
          {["Member", "Role", "Status", "Joined", "Actions"].map(h => (
            <p key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8", margin: 0 }}>{h}</p>
          ))}
        </div>

        {members.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#64748b", fontSize: 13 }}>No team members found in workspace.</div>
        ) : (
          members.map((m, idx) => (
            <div key={m._id} style={{
              display: "grid", gridTemplateColumns: "1fr 140px 120px 140px 110px",
              alignItems: "center", padding: "14px 20px",
              borderBottom: idx < members.length - 1 ? "1px solid #f8fafc" : "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: ACCENT_LIGHT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: ACCENT }}>
                  {m.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</p>
                  <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>{m.email}</p>
                </div>
              </div>

              <span style={{ fontSize: 12, color: "#475569", textTransform: "capitalize", fontWeight: 500 }}>{m.role || "User"}</span>

              <div>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 99,
                  background: m.is_active ? "#dcfce7" : "#f4f4f5",
                  color: m.is_active ? "#15803d" : "#71717a",
                }}>
                  {m.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>{fmtD(m.created_at)}</p>

              <div>
                <button
                  onClick={() => toggleStatus(m)}
                  title={m.is_active ? "Deactivate member" : "Activate member"}
                  style={{ background: "#f1f5f9", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 600, color: "#475569", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                >
                  {m.is_active ? <UserX size={13} color="#dc2626" /> : <UserCheck size={13} color="#15803d" />}
                  {m.is_active ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
