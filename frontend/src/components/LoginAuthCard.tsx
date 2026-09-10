import { useState } from "react";
import { Mail, Lock, User, ArrowRight, Eye, EyeOff, Check, X } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export type Step = "login" | "signup-start" | "signup-verify" | "forgot" | "reset" | "invite";

const INK        = "#22293A";
const ACCENT     = "#3E4C6B";
const ACCENT_DK  = "#2F3A54";
const PAPER      = "#F7F6F3";
const LINE       = "#E4E1DA";
const SUBTLE     = "#75726B";

const isEmailValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const pwChecks = (pw: string) => ({
  minLen: pw.length >= 8,
  hasUpper: /[A-Z]/.test(pw),
  hasLower: /[a-z]/.test(pw),
  hasNum: /[0-9]/.test(pw),
});

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <p style={{ fontSize: 12.5, fontWeight: 600, color: "#4A473F", marginBottom: 6 }}>
      {text}{required && <span style={{ color: "#B4483C" }}> *</span>}
    </p>
  );
}

function Input({ icon: Icon, isValid, right, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { icon?: any; isValid?: boolean; right?: React.ReactNode }) {
  return (
    <div style={{ position: "relative" }}>
      {Icon && <Icon size={15} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#A6A296", pointerEvents: "none" }} />}
      <input
        style={{
          width: "100%", background: "#ffffff",
          border: `1px solid ${isValid === false ? "#D79088" : isValid === true ? "#9AB6A0" : "#D9D5CB"}`,
          borderRadius: 8,
          padding: Icon ? "12px 14px 12px 40px" : "12px 14px",
          paddingRight: right ? 44 : 14,
          fontSize: 13.5, color: INK, outline: "none", fontFamily: "inherit",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
          boxShadow: isValid === false ? "0 0 0 3px rgba(180,72,60,0.08)" : "none",
        }}
        onFocus={e => {
          if (isValid !== false) {
            e.target.style.borderColor = ACCENT;
            e.target.style.boxShadow = `0 0 0 3px rgba(62,76,107,0.14)`;
          }
        }}
        onBlur={e => {
          if (isValid === undefined) {
            e.target.style.borderColor = "#D9D5CB";
            e.target.style.boxShadow = "none";
          }
        }}
        {...props}
      />
      {right && <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}>{right}</div>}
    </div>
  );
}

function PwChecklist({ pw }: { pw: string }) {
  const c = pwChecks(pw);
  if (!pw) return null;
  return (
    <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: "9px 11px", background: PAPER, borderRadius: 7, border: `1px solid ${LINE}` }}>
      {[
        { label: "8+ characters", ok: c.minLen },
        { label: "One uppercase", ok: c.hasUpper },
        { label: "One lowercase", ok: c.hasLower },
        { label: "One number",    ok: c.hasNum },
      ].map((item, idx) => (
        <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: item.ok ? "#4C7A5A" : "#A6A296", fontWeight: item.ok ? 600 : 400 }}>
          {item.ok ? <Check size={12} color="#4C7A5A" /> : <X size={12} color="#D9D5CB" />}
          {item.label}
        </div>
      ))}
    </div>
  );
}

function Btn({ loading, disabled, children }: { loading?: boolean; disabled?: boolean; children: React.ReactNode }) {
  const isOff = loading || disabled;
  return (
    <button
      type="submit"
      disabled={isOff}
      style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        background: isOff ? "#E4E1DA" : ACCENT,
        color: isOff ? "#A6A296" : "#ffffff",
        border: "none", borderRadius: 8,
        padding: "13px 20px", fontSize: 14, fontWeight: 600,
        cursor: isOff ? "not-allowed" : "pointer",
        fontFamily: "inherit", transition: "background 0.15s ease",
      }}
      onMouseEnter={e => { if (!isOff) (e.currentTarget as HTMLButtonElement).style.background = ACCENT_DK; }}
      onMouseLeave={e => { if (!isOff) (e.currentTarget as HTMLButtonElement).style.background = ACCENT; }}
    >
      {loading
        ? <><span style={{ width: 15, height: 15, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} /><span>Please wait…</span></>
        : <><span>{children}</span><ArrowRight size={15} /></>
      }
    </button>
  );
}

function Ghost({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{
      background: "none", border: "none",
      padding: "6px 0", fontSize: 13, color: SUBTLE,
      cursor: "pointer", fontFamily: "inherit", fontWeight: 500,
      transition: "color 0.15s ease",
    }}
    onMouseEnter={e => (e.currentTarget.style.color = ACCENT)}
    onMouseLeave={e => (e.currentTarget.style.color = SUBTLE)}>
      {children}
    </button>
  );
}

function Msg({ type, text }: { type: "error" | "ok"; text: string }) {
  const isErr = type === "error";
  return (
    <div style={{
      padding: "11px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500,
      background: isErr ? "#FBEEEC" : "#EEF4EF",
      border: `1px solid ${isErr ? "#E2B3AC" : "#B7D0BC"}`,
      color: isErr ? "#A0392C" : "#3E6B4A",
      display: "flex", alignItems: "center", gap: 8,
    }}>
      {isErr ? <X size={15} /> : <Check size={15} />}
      <span>{text}</span>
    </div>
  );
}

export default function LoginAuthCard() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [step, setStep]       = useState<Step>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [showPw, setShowPw]   = useState(false);
  const [f, setF] = useState({ name:"", email:"", pw:"", otp:"", forgotEmail:"", resetCode:"", resetPw:"", invEmail:"", invCode:"", invPw:"" });

  const up = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, [k]: e.target.value }));
  const clr = () => { setError(""); setSuccess(""); };
  const go  = (s: Step) => {
    clr();
    if (s === "forgot" && !f.forgotEmail && f.email) setF(p => ({ ...p, forgotEmail: p.email }));
    if (s === "reset" && !f.forgotEmail && f.email) setF(p => ({ ...p, forgotEmail: p.email }));
    setStep(s);
  };

  async function wrap(fn: () => Promise<void>) {
    clr(); setLoading(true);
    try { await fn(); }
    catch (e: any) {
      const errMsg = e.response?.data?.detail || "Something went wrong";
      setError(errMsg);
      toast.error(errMsg);
    }
    finally { setLoading(false); }
  }

  const cardStyle: React.CSSProperties = {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: "32px 30px",
  };

  const headline: React.CSSProperties = {
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: 20, fontWeight: 800, marginBottom: 4, letterSpacing: "-0.02em", color: "#0f172a", lineHeight: 1.25,
  };
  const sub: React.CSSProperties = { color: "#64748b", fontSize: 13, marginBottom: 24, lineHeight: 1.5 };

  return (
    <>
      {/* ── LOGIN ── */}
      {step === "login" && (
        <div style={cardStyle}>
          <h1 style={headline}>Welcome back</h1>
          <p style={sub}>Sign in to your workspace</p>

          <form onSubmit={e => {
            e.preventDefault();
            if (!isEmailValid(f.email)) { setError("Please enter a valid email address"); return; }
            wrap(async () => {
              const { data } = await api.post("/auth/login", { email: f.email, password: f.pw });
              login(data.access_token, data.name, data.role);
              toast.success(`Welcome back, ${data.name}!`);
            });
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {error && <Msg type="error" text={error} />}
              <div>
                <Label text="Work email" required />
                <Input icon={Mail} type="email" placeholder="you@company.com" value={f.email} onChange={up("email")} required isValid={f.email ? isEmailValid(f.email) : undefined} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <Label text="Password" required />
                  <button type="button" onClick={() => go("forgot")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: ACCENT, fontFamily: "inherit", padding: 0, fontWeight: 500 }}>
                    Forgot password?
                  </button>
                </div>
                <Input icon={Lock} type={showPw ? "text" : "password"} placeholder="••••••••" value={f.pw} onChange={up("pw")} required
                  right={<button type="button" onClick={() => setShowPw(!showPw)} style={{ background: "none", border: "none", cursor: "pointer", color: "#A6A296", display: "flex" }}>{showPw ? <EyeOff size={15}/> : <Eye size={15}/>}</button>}
                />
              </div>
              <Btn loading={loading}>Sign in</Btn>
            </div>
          </form>

          <div style={{ height: 1, background: LINE, margin: "22px 0" }} />

          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
            <p style={{ fontSize: 13, color: SUBTLE, margin: 0 }}>
              Don't have an account?{" "}
              <button type="button" onClick={() => go("signup-start")} style={{ background: "none", border: "none", cursor: "pointer", color: ACCENT, fontFamily: "inherit", fontSize: 13, fontWeight: 600, padding: 0 }}>
                Create workspace
              </button>
            </p>
            <p style={{ fontSize: 13, color: SUBTLE, margin: 0 }}>
              Have an invite code?{" "}
              <button type="button" onClick={() => go("invite")} style={{ background: "none", border: "none", cursor: "pointer", color: ACCENT, fontFamily: "inherit", fontSize: 13, fontWeight: 600, padding: 0 }}>
                Activate account
              </button>
            </p>
          </div>
        </div>
      )}

      {/* ── SIGNUP START ── */}
      {step === "signup-start" && (
        <div style={cardStyle}>
          <h1 style={headline}>Create your workspace</h1>
          <p style={sub}>We'll send a 6-digit code to verify your email</p>
          <form onSubmit={e => {
            e.preventDefault();
            if (!isEmailValid(f.email)) { setError("Please enter a valid email"); return; }
            wrap(async () => {
              await api.post("/auth/start-signup", { name: f.name, email: f.email });
              setSuccess("Verification code sent to your email.");
              toast.success("Code sent — check your inbox.");
              go("signup-verify");
            });
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {error && <Msg type="error" text={error} />}
              {success && <Msg type="ok" text={success} />}
              <div><Label text="Full name" required /><Input icon={User} placeholder="Jane Smith" value={f.name} onChange={up("name")} required /></div>
              <div><Label text="Work email" required /><Input icon={Mail} type="email" placeholder="you@company.com" value={f.email} onChange={up("email")} required isValid={f.email ? isEmailValid(f.email) : undefined} /></div>
              <Btn loading={loading}>Send verification code</Btn>
            </div>
          </form>
          <div style={{ marginTop: 14 }}><Ghost onClick={() => go("login")}>← Back to sign in</Ghost></div>
        </div>
      )}

      {/* ── SIGNUP VERIFY ── */}
      {step === "signup-verify" && (
        <div style={cardStyle}>
          <h1 style={headline}>Verify and set a password</h1>
          <p style={sub}>Enter the code sent to <span style={{ color: ACCENT, fontWeight: 600 }}>{f.email}</span></p>
          <form onSubmit={e => {
            e.preventDefault();
            const checks = pwChecks(f.pw);
            if (!checks.minLen || !checks.hasUpper || !checks.hasLower || !checks.hasNum) {
              setError("Password does not meet the requirements below");
              return;
            }
            wrap(async () => {
              await api.post("/auth/complete-signup", { name: f.name, email: f.email, otp: f.otp, password: f.pw });
              setSuccess("Account created.");
              toast.success("Account created — redirecting to sign in…");
              setTimeout(() => go("login"), 1500);
            });
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {error && <Msg type="error" text={error} />}
              {success && <Msg type="ok" text={success} />}
              <div>
                <Label text="6-digit code" required />
                <Input placeholder="123456" maxLength={6} value={f.otp} onChange={up("otp")} required style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.15em", fontSize: 16, fontWeight: 600 }} />
              </div>
              <div>
                <Label text="Set password" required />
                <Input type={showPw ? "text" : "password"} placeholder="Min 8 characters" value={f.pw} onChange={up("pw")} required right={<button type="button" onClick={() => setShowPw(!showPw)} style={{ background: "none", border: "none", cursor: "pointer", color: "#A6A296", display: "flex" }}>{showPw ? <EyeOff size={15}/> : <Eye size={15}/>}</button>} />
                <PwChecklist pw={f.pw} />
              </div>
              <Btn loading={loading}>Complete setup</Btn>
            </div>
          </form>
          <div style={{ marginTop: 14, display: "flex", gap: 14, alignItems: "center" }}>
            <Ghost onClick={() => go("login")}>← Back to sign in</Ghost>
            <Ghost onClick={() => go("signup-start")}>Resend code</Ghost>
          </div>
        </div>
      )}

      {/* ── FORGOT ── */}
      {step === "forgot" && (
        <div style={cardStyle}>
          <h1 style={headline}>Forgot password?</h1>
          <p style={sub}>Enter your registered email to get a reset code</p>
          <form onSubmit={e => {
            e.preventDefault();
            const targetEmail = f.forgotEmail || f.email;
            if (!isEmailValid(targetEmail)) { setError("Please enter a valid email"); return; }
            wrap(async () => {
              await api.post("/auth/forgot-password", { email: targetEmail });
              setF(p => ({ ...p, forgotEmail: targetEmail }));
              setSuccess("Reset code sent, if that account exists.");
              toast.info("Reset code sent to your inbox.");
              go("reset");
            });
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {error && <Msg type="error" text={error} />}
              {success && <Msg type="ok" text={success} />}
              <div><Label text="Account email" required /><Input icon={Mail} type="email" placeholder="you@example.com" value={f.forgotEmail || f.email} onChange={up("forgotEmail")} required isValid={f.forgotEmail ? isEmailValid(f.forgotEmail) : undefined} /></div>
              <Btn loading={loading}>Send reset code</Btn>
            </div>
          </form>
          <div style={{ marginTop: 14, display: "flex", gap: 14, alignItems: "center" }}>
            <Ghost onClick={() => go("login")}>← Back to sign in</Ghost>
            <Ghost onClick={() => go("reset")}>Already have a code?</Ghost>
          </div>
        </div>
      )}

      {/* ── RESET ── */}
      {step === "reset" && (
        <div style={cardStyle}>
          <h1 style={headline}>Set a new password</h1>
          <p style={sub}>Enter the reset code sent to your email</p>
          <form onSubmit={e => {
            e.preventDefault();
            const targetEmail = f.forgotEmail || f.email;
            const checks = pwChecks(f.resetPw);
            if (!checks.minLen || !checks.hasUpper || !checks.hasLower || !checks.hasNum) {
              setError("Password does not meet the requirements below");
              return;
            }
            wrap(async () => {
              await api.post("/auth/reset-password", { email: targetEmail, reset_code: f.resetCode, password: f.resetPw });
              setSuccess("Password updated.");
              toast.success("Password updated — redirecting to sign in…");
              setTimeout(() => go("login"), 1500);
            });
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {error && <Msg type="error" text={error} />}
              {success && <Msg type="ok" text={success} />}
              <div><Label text="Account email" required /><Input icon={Mail} type="email" placeholder="you@example.com" value={f.forgotEmail || f.email} onChange={up("forgotEmail")} required /></div>
              <div><Label text="6-digit reset code" required /><Input placeholder="123456" maxLength={6} value={f.resetCode} onChange={up("resetCode")} required style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.15em", fontSize: 16, fontWeight: 600 }} /></div>
              <div>
                <Label text="New password" required />
                <Input type={showPw ? "text" : "password"} placeholder="Min 8 characters" value={f.resetPw} onChange={up("resetPw")} required right={<button type="button" onClick={() => setShowPw(!showPw)} style={{ background: "none", border: "none", cursor: "pointer", color: "#A6A296", display: "flex" }}>{showPw ? <EyeOff size={15}/> : <Eye size={15}/>}</button>} />
                <PwChecklist pw={f.resetPw} />
              </div>
              <Btn loading={loading}>Update password</Btn>
            </div>
          </form>
          <div style={{ marginTop: 14, display: "flex", gap: 14, alignItems: "center" }}>
            <Ghost onClick={() => go("login")}>← Back to sign in</Ghost>
            <Ghost onClick={() => go("forgot")}>Resend code</Ghost>
          </div>
        </div>
      )}

      {/* ── INVITE ── */}
      {step === "invite" && (
        <div style={cardStyle}>
          <h1 style={headline}>Join a workspace</h1>
          <p style={sub}>Activate your account with your invite code</p>
          <form onSubmit={e => {
            e.preventDefault();
            const checks = pwChecks(f.invPw);
            if (!checks.minLen || !checks.hasUpper || !checks.hasLower || !checks.hasNum) {
              setError("Password does not meet the requirements below");
              return;
            }
            wrap(async () => {
              await api.post("/auth/verify-invite", { email: f.invEmail, invite_code: f.invCode, password: f.invPw });
              setSuccess("Account activated.");
              toast.success("Account activated — redirecting to sign in…");
              setTimeout(() => go("login"), 1500);
            });
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {error && <Msg type="error" text={error} />}
              {success && <Msg type="ok" text={success} />}
              <div><Label text="Your email" required /><Input icon={Mail} type="email" placeholder="you@example.com" value={f.invEmail} onChange={up("invEmail")} required isValid={f.invEmail ? isEmailValid(f.invEmail) : undefined} /></div>
              <div><Label text="Invite code" required /><Input placeholder="ABC123" maxLength={6} value={f.invCode} onChange={e => setF(p => ({ ...p, invCode: e.target.value.toUpperCase() }))} required style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.2em", fontSize: 16, fontWeight: 600 }} /></div>
              <div>
                <Label text="Set password" required />
                <Input type={showPw ? "text" : "password"} placeholder="Min 8 characters" value={f.invPw} onChange={up("invPw")} required right={<button type="button" onClick={() => setShowPw(!showPw)} style={{ background: "none", border: "none", cursor: "pointer", color: "#A6A296", display: "flex" }}>{showPw ? <EyeOff size={15}/> : <Eye size={15}/>}</button>} />
                <PwChecklist pw={f.invPw} />
              </div>
              <Btn loading={loading}>Activate account</Btn>
            </div>
          </form>
          <div style={{ marginTop: 14 }}><Ghost onClick={() => go("login")}>← Back to sign in</Ghost></div>
        </div>
      )}
    </>
  );
}
