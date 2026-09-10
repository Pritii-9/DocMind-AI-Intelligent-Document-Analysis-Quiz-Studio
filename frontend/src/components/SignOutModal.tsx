import { X, LogOut } from "lucide-react";

interface SignOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function SignOutModal({ isOpen, onClose, onConfirm }: SignOutModalProps) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000,
      background: "rgba(15, 23, 42, 0.5)",
      backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }} className="fade-in">
      <div style={{
        background: "#ffffff",
        borderRadius: 16,
        boxShadow: "0 20px 40px -10px rgba(0,0,0,0.15)",
        border: "1px solid #e2e8f0",
        maxWidth: 400, width: "100%", padding: 24,
        position: "relative",
      }} className="animate-in">
        <button
          onClick={onClose}
          style={{ position: "absolute", right: 18, top: 18, background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
        >
          <X size={16} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "#fee2e2", border: "1px solid #fca5a5",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <LogOut size={18} color="#dc2626" />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: 0 }}>
              Sign out of workspace?
            </h3>
            <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0 0" }}>
              Active session
            </p>
          </div>
        </div>

        <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, margin: "0 0 22px 0" }}>
          Are you sure you want to sign out? You'll need to enter your credentials to log back in.
        </p>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 8,
              padding: "9px 16px", fontSize: 13, fontWeight: 600, color: "#475569",
              cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#94a3b8"; e.currentTarget.style.color = "#0f172a"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.color = "#475569"; }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              background: "#dc2626", border: "none", borderRadius: 8,
              padding: "9px 18px", fontSize: 13, fontWeight: 600, color: "#ffffff",
              cursor: "pointer", boxShadow: "0 2px 8px rgba(220,38,38,0.25)",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#b91c1c"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#dc2626"; }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
