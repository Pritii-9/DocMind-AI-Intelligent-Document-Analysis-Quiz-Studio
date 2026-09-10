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

const fmtD = (s?: string) =>
  s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export default function TeamView() {
  const { toast }                   = useToast();
  const [members, setMembers]       = useState<Member[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting]     = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/auth/users")
      .then(r => setMembers(r.data))
      .catch(err => toast.error(err.response?.data?.detail || "Failed to load team members."))
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
      setShowInvite(false); setInviteName(""); setInviteEmail("");
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
      toast.error(err.response?.data?.detail || "Failed to update status.");
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[80vh] gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[var(--brand)] spin" />
      <p className="text-[13px] text-slate-500">Loading workspace team…</p>
    </div>
  );

  return (
    <div className="animate-in p-7 bg-slate-50 min-h-[calc(100vh-60px)] font-[Inter,system-ui,sans-serif]">

      {/* Header */}
      <div className="flex items-end justify-between mb-7">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">Team Management</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Manage workspace accounts, roles, and member invitations.</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl border-none cursor-pointer transition-all duration-150 hover:-translate-y-px"
          style={{ background: "var(--brand)", boxShadow: "0 4px 14px rgba(61,79,110,0.3)" }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--brand-hover)")}
          onMouseLeave={e => (e.currentTarget.style.background = "var(--brand)")}
        >
          <UserPlus size={15} /> Invite member
        </button>
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-[420px] p-6">
            <h3 className="text-base font-bold text-slate-900 mb-1">Invite team member</h3>
            <p className="text-xs text-slate-500 mb-5">An onboarding invite code will be sent to their email address.</p>
            <form onSubmit={sendInvite} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Full Name</label>
                <input
                  type="text" required placeholder="Aarav Mehta"
                  value={inviteName} onChange={e => setInviteName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-[13px] text-slate-900 outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Work Email</label>
                <input
                  type="email" required placeholder="aarav@company.com"
                  value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-[13px] text-slate-900 outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-colors"
                />
              </div>
              <div className="flex gap-2.5 justify-end mt-1">
                <button
                  type="button"
                  onClick={() => setShowInvite(false)}
                  className="px-4 py-2 text-[13px] font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg cursor-pointer hover:border-slate-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="px-4 py-2 text-[13px] font-semibold text-white rounded-lg border-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
                  style={{ background: "var(--brand)" }}
                >
                  {inviting ? "Sending…" : "Send invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Members Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="grid gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50 rounded-t-2xl" style={{ gridTemplateColumns: "1fr 130px 110px 140px 110px" }}>
          {["Member", "Role", "Status", "Joined", "Actions"].map(h => (
            <p key={h} className="text-[10px] font-bold tracking-widest uppercase text-slate-400 m-0">{h}</p>
          ))}
        </div>

        {members.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-slate-500">No team members found in workspace.</div>
        ) : (
          members.map((m, idx) => (
            <div
              key={m._id}
              className="grid items-center px-5 py-3.5 gap-4 hover:bg-slate-50 transition-colors"
              style={{
                gridTemplateColumns: "1fr 130px 110px 140px 110px",
                borderBottom: idx < members.length - 1 ? "1px solid #f8fafc" : "none",
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-[13px] font-bold"
                  style={{ background: "var(--brand-light)", color: "var(--brand)" }}
                >
                  {m.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-slate-900 truncate">{m.name}</p>
                  <p className="text-[11px] text-slate-400">{m.email}</p>
                </div>
              </div>

              <span className="text-xs text-slate-500 capitalize font-medium">{m.role || "User"}</span>

              <span
                className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  m.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {m.is_active ? "Active" : "Inactive"}
              </span>

              <p className="text-xs text-slate-500">{fmtD(m.created_at)}</p>

              <button
                onClick={() => toggleStatus(m)}
                title={m.is_active ? "Deactivate member" : "Activate member"}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 bg-slate-100 border-none rounded-md cursor-pointer hover:bg-slate-200 transition-colors"
              >
                {m.is_active
                  ? <UserX size={13} className="text-red-500" />
                  : <UserCheck size={13} className="text-green-600" />}
                {m.is_active ? "Deactivate" : "Activate"}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
