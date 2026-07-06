import { Mail, User, UserPlus, X } from "lucide-react";
import { useState } from "react";

import api from "../api/axios";

export default function InviteModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    setName("");
    setEmail("");
    setMessage(null);
    setError(null);
  };

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await api.post("/auth/invite-member", { name, email });
      setMessage(`Invitation sent successfully! An email has been dispatched with their secure join link.`);
      setName("");
      setEmail("");
    } catch (err) {
      const fallback = "Failed to send invitation.";
      if (typeof err === "object" && err !== null && "response" in err) {
        const response = (err as { response?: { data?: { msg?: string } } }).response;
        setError(response?.data?.msg || fallback);
      } else {
        setError(fallback);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[2rem] border border-black/5 bg-[var(--panel)] p-8 shadow-2xl dark:border-white/10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <UserPlus size={22} />
            </div>
            <h2 className="mt-4 font-display text-2xl font-semibold text-[var(--text-strong)]">Invite a new teammate</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
              Send onboarding access to a workspace member so they can start viewing secure documents.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              resetState();
              onClose();
            }}
            className="rounded-full p-2 text-[var(--text-soft)] transition hover:bg-[var(--panel-muted)] hover:text-[var(--text-strong)]"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleInvite} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--text-soft)]">
              <User size={16} />
              Full name
            </span>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-2xl border border-black/5 bg-[var(--panel-muted)] px-4 py-3 text-[var(--text-strong)] outline-none transition focus:border-[var(--accent)] dark:border-white/10"
              placeholder="Aarav Mehta"
            />
          </label>

          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--text-soft)]">
              <Mail size={16} />
              Work email
            </span>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-black/5 bg-[var(--panel-muted)] px-4 py-3 text-[var(--text-strong)] outline-none transition focus:border-[var(--accent)] dark:border-white/10"
              placeholder="aarav@company.com"
            />
          </label>

          {message ? <p className="text-sm font-medium text-emerald-600">{message}</p> : null}
          {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-[var(--button-primary-bg)] px-4 py-3 text-sm font-semibold text-[var(--button-primary-text)] transition hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Sending invite..." : "Send invitation"}
          </button>
        </form>
      </div>
    </div>
  );
}
