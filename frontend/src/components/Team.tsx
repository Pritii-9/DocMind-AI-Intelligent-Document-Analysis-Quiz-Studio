import { useEffect, useState } from "react";
import { UserPlus, Check, Copy, UserCheck, UserX } from "lucide-react";
import api from "../api/client";
import { useToast } from "../context/ToastContext";

interface Member {
  id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  joined_at: string;
}

interface Invite {
  code: string;
  email: string;
  created_at: string;
  expires_at: string;
}

const ACCENT        = "oklch(45% 0.033 256.848)";
const ACCENT_HOVER  = "oklch(52% 0.04 256.848)";
const ACCENT_LIGHT  = "oklch(96% 0.015 256.848)";

const fmtD = (s: string) => new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const card: React.CSSProperties = {
  background: "#ffffff", borderRadius: 14,
  boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.03)",
  border: "1px solid #e2e8f0",
};

export default function TeamView() {
  const { toast }                     = useToast();
  const [members, setMembers]         = useState<Member[]>([]);
  const [invites, setInvites]         = useState<Invite[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showInvite, setShowInvite]   = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [copiedCode, setCopiedCode]   = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get("/workspace/members").then(r => r.data),
      api.get("/workspace/invites").then(r => r.data),
    ]).then(([m, i]) => { setMembers(m); setInvites(i); }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  async function sendInvite() {
    if (!inviteEmail) return;
    try {
      await api.post("/workspace/invite", { email: inviteEmail });
      toast.success(`Invite code sent to ${inviteEmail}`);
      setShowInvite(false); setInviteEmail("");
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.detail || "Failed to send invitation.");
    }
  }

  async function toggleStatus(m: Member) {
    try {
      await api.patch(`/workspace/members/${m.id}`, { is_active: !m.is_active });
      toast.success(`${m.name} is now ${!m.is_active ? "active" : "inactive"}`);
      load();
    } catch {
      toast.error("Failed to update status");
    }
  }

  function copyInviteCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.info("Invite code copied to clipboard");
    setTimeout(() => setCopiedCode(null), 2000);
  }

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "80vh", gap: 12 }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #e2e8f0", borderTopColor: ACCENT }} className="spin" />
      <p style={{ fontSize: 13, color: "#64748b" }}>Loading team…</p>
    </div>
  );

  return (
    <div className="animate-in" style={{ padding: "28px 32px", background: "#f8fafc", minHeight: "calc(100vh - 60px)", fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: "#0f172a" }}>Team</h1>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>Manage workspace accounts and member invitations.</p>
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
          <div style={{ ...card, width: "100%", maxWidth: 400, padding: 24, position: "relative" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Invite team member</h3>
            <p style={{ fontSize: 12, color: "#64748b", marginBottom: 20 }}>An invite code will be sent to their email address.</p>

            <form onSubmit={e => { e.preventDefault(); sendInvite(); }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", display: "block", marginBottom: 6 }}>Email address</label>
              <input
                type="email" required placeholder="colleague@company.com"
                value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, color: "#0f172a", outline: "none", marginBottom: 20 }}
              />

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowInvite(false)} style={{ background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, color: "#475569", cursor: "pointer" }}>
                  Cancel
                </button>
                <button type="submit" style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Send invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pending Invites */}
      {invites.length > 0 && (
        <div style={{ ...card, marginBottom: 24, padding: "20px 24px" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>Pending invitations</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {invites.map(inv => (
              <div key={inv.code} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", margin: 0 }}>{inv.email}</p>
                  <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>Expires {fmtD(inv.expires_at)}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <code style={{ fontSize: 12, fontWeight: 700, background: ACCENT_LIGHT, color: ACCENT, padding: "3px 8px", borderRadius: 6 }}>{inv.code}</code>
                  <button onClick={() => copyInviteCode(inv.code)} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", fontSize: 12, fontWeight: 600, color: "#475569", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                    {copiedCode === inv.code ? <Check size={12} color="#15803d" /> : <Copy size={12} />} Copy
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Members Table */}
      <div style={card}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 120px 140px 100px", padding: "12px 20px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc", borderRadius: "14px 14px 0 0" }}>
          {["Member", "Role", "Status", "Joined", "Actions"].map(h => (
            <p key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8", margin: 0 }}>{h}</p>
          ))}
        </div>

        {members.map((m, idx) => (
          <div key={m.id} style={{
            display: "grid", gridTemplateColumns: "1fr 140px 120px 140px 100px",
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

            <span style={{ fontSize: 12, color: "#475569", textTransform: "capitalize", fontWeight: 500 }}>{m.role}</span>

            <div>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 99,
                background: m.is_active ? "#dcfce7" : "#f4f4f5",
                color: m.is_active ? "#15803d" : "#71717a",
              }}>
                {m.is_active ? "Active" : "Inactive"}
              </span>
            </div>

            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>{fmtD(m.joined_at)}</p>

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
        ))}
      </div>

    </div>
  );
}
