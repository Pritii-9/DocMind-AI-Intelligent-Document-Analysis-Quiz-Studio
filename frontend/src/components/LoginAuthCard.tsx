import { useState } from "react";
import { Mail, Lock, User, ArrowRight, Eye, EyeOff, Check, X } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export type Step = "login" | "signup-start" | "signup-verify" | "forgot" | "reset" | "invite";

const isEmailValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const pwChecks = (pw: string) => ({
  minLen:   pw.length >= 8,
  hasUpper: /[A-Z]/.test(pw),
  hasLower: /[a-z]/.test(pw),
  hasNum:   /[0-9]/.test(pw),
});

/* ── Sub-components ── */

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <p className="text-[12.5px] font-semibold text-slate-600 mb-1.5">
      {text}{required && <span className="text-red-500"> *</span>}
    </p>
  );
}

function Input({ icon: Icon, isValid, right, className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement> & { icon?: any; isValid?: boolean; right?: React.ReactNode }) {
  return (
    <div className="relative">
      {Icon && <Icon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />}
      <input
        className={[
          "w-full bg-white rounded-lg text-[13.5px] text-slate-800 outline-none transition-all duration-150 font-[inherit]",
          "border focus:ring-[3px]",
          Icon ? "pl-10" : "pl-3.5",
          right ? "pr-11" : "pr-3.5",
          "py-3",
          isValid === false
            ? "border-red-300 focus:border-red-400 focus:ring-red-100"
            : isValid === true
            ? "border-green-300 focus:border-green-400 focus:ring-green-100"
            : "border-slate-300 focus:border-[var(--brand)] focus:ring-[var(--brand)]/15",
          className,
        ].join(" ")}
        {...props}
      />
      {right && <div className="absolute right-3 top-1/2 -translate-y-1/2">{right}</div>}
    </div>
  );
}

function PwChecklist({ pw }: { pw: string }) {
  const c = pwChecks(pw);
  if (!pw) return null;
  const items = [
    { label: "8+ characters", ok: c.minLen  },
    { label: "One uppercase",  ok: c.hasUpper },
    { label: "One lowercase",  ok: c.hasLower },
    { label: "One number",     ok: c.hasNum   },
  ];
  return (
    <div className="mt-2 grid grid-cols-2 gap-1.5 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
      {items.map((item, i) => (
        <div key={i} className={`flex items-center gap-1.5 text-[11.5px] ${item.ok ? "text-green-700 font-semibold" : "text-slate-400"}`}>
          {item.ok ? <Check size={12} className="text-green-600" /> : <X size={12} className="text-slate-300" />}
          {item.label}
        </div>
      ))}
    </div>
  );
}

function Btn({ loading, disabled, children }: { loading?: boolean; disabled?: boolean; children: React.ReactNode }) {
  const off = loading || disabled;
  return (
    <button
      type="submit"
      disabled={off}
      className={[
        "w-full flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold font-[inherit] transition-all duration-150",
        off
          ? "bg-slate-200 text-slate-400 cursor-not-allowed"
          : "text-white cursor-pointer hover:brightness-90 active:scale-[0.98]",
      ].join(" ")}
      style={off ? undefined : { background: "var(--brand)" }}
    >
      {loading ? (
        <>
          <span className="w-[15px] h-[15px] border-2 border-white/40 border-t-white rounded-full inline-block spin" />
          <span>Please wait…</span>
        </>
      ) : (
        <>{children}<ArrowRight size={15} /></>
      )}
    </button>
  );
}

function Ghost({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-transparent border-none py-1.5 text-[13px] text-slate-500 font-medium cursor-pointer font-[inherit] hover:text-[var(--brand)] transition-colors"
    >
      {children}
    </button>
  );
}

function Msg({ type, text }: { type: "error" | "ok"; text: string }) {
  const isErr = type === "error";
  return (
    <div className={[
      "flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-[13px] font-medium",
      isErr ? "bg-red-50 border border-red-200 text-red-700" : "bg-green-50 border border-green-200 text-green-700",
    ].join(" ")}>
      {isErr ? <X size={15} /> : <Check size={15} />}
      <span>{text}</span>
    </div>
  );
}

/* ── Main component ── */

export default function LoginAuthCard() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [step, setStep]       = useState<Step>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [showPw, setShowPw]   = useState(false);
  const [f, setF] = useState({ name:"", email:"", pw:"", otp:"", forgotEmail:"", resetCode:"", resetPw:"", invEmail:"", invCode:"", invPw:"" });

  const up  = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, [k]: e.target.value }));
  const clr = () => { setError(""); setSuccess(""); };
  const go  = (s: Step) => { clr(); setStep(s); };

  async function wrap(fn: () => Promise<void>) {
    clr(); setLoading(true);
    try { await fn(); }
    catch (e: any) {
      const msg = e.response?.data?.detail || "Something went wrong";
      setError(msg); toast.error(msg);
    }
    finally { setLoading(false); }
  }

  const cardCls = "bg-white border border-slate-200 rounded-2xl p-8";
  const headCls = "text-[20px] font-extrabold tracking-[-0.02em] text-slate-900 leading-snug mb-1";
  const subCls  = "text-[13px] text-slate-500 mb-6 leading-relaxed";

  const eyeBtn = (
    <button type="button" onClick={() => setShowPw(!showPw)} className="bg-transparent border-none cursor-pointer text-slate-400 flex hover:text-slate-600 transition-colors">
      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
    </button>
  );

  return (
    <>
      {/* ── LOGIN ── */}
      {step === "login" && (
        <div className={cardCls}>
          <h1 className={headCls}>Welcome back</h1>
          <p className={subCls}>Sign in to your workspace</p>

          <form onSubmit={e => {
            e.preventDefault();
            if (!isEmailValid(f.email)) { setError("Please enter a valid email address"); return; }
            wrap(async () => {
              const { data } = await api.post("/auth/login", { email: f.email, password: f.pw });
              login(data.access_token, data.name, data.role);
              toast.success(`Welcome back, ${data.name}!`);
            });
          }}>
            <div className="flex flex-col gap-4">
              {error && <Msg type="error" text={error} />}
              <div>
                <Label text="Work email" required />
                <Input icon={Mail} type="email" placeholder="you@company.com" value={f.email} onChange={up("email")} required isValid={f.email ? isEmailValid(f.email) : undefined} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label text="Password" required />
                  <button type="button" onClick={() => go("forgot")} className="bg-transparent border-none cursor-pointer text-xs font-medium font-[inherit] hover:underline transition-colors" style={{ color: "var(--brand)" }}>
                    Forgot password?
                  </button>
                </div>
                <Input icon={Lock} type={showPw ? "text" : "password"} placeholder="••••••••" value={f.pw} onChange={up("pw")} required right={eyeBtn} />
              </div>
              <Btn loading={loading}>Sign in</Btn>
            </div>
          </form>

          <div className="h-px bg-slate-200 my-5" />

          <div className="flex flex-col gap-1 items-center">
            <p className="text-[13px] text-slate-500">
              Don't have an account?{" "}
              <button type="button" onClick={() => go("signup-start")} className="bg-transparent border-none cursor-pointer text-[13px] font-semibold font-[inherit] hover:underline" style={{ color: "var(--brand)" }}>
                Create workspace
              </button>
            </p>
            <p className="text-[13px] text-slate-500">
              Have an invite code?{" "}
              <button type="button" onClick={() => go("invite")} className="bg-transparent border-none cursor-pointer text-[13px] font-semibold font-[inherit] hover:underline" style={{ color: "var(--brand)" }}>
                Activate account
              </button>
            </p>
          </div>
        </div>
      )}

      {/* ── SIGNUP START ── */}
      {step === "signup-start" && (
        <div className={cardCls}>
          <h1 className={headCls}>Create your workspace</h1>
          <p className={subCls}>We'll send a 6-digit code to verify your email</p>
          <form onSubmit={e => {
            e.preventDefault();
            if (!isEmailValid(f.email)) { setError("Please enter a valid email"); return; }
            wrap(async () => {
              await api.post("/auth/start-signup", { name: f.name, email: f.email });
              toast.success("Code sent — check your inbox.");
              go("signup-verify");
            });
          }}>
            <div className="flex flex-col gap-4">
              {error && <Msg type="error" text={error} />}
              {success && <Msg type="ok" text={success} />}
              <div><Label text="Full name" required /><Input icon={User} placeholder="Jane Smith" value={f.name} onChange={up("name")} required /></div>
              <div><Label text="Work email" required /><Input icon={Mail} type="email" placeholder="you@company.com" value={f.email} onChange={up("email")} required isValid={f.email ? isEmailValid(f.email) : undefined} /></div>
              <Btn loading={loading}>Send verification code</Btn>
            </div>
          </form>
          <div className="mt-3.5"><Ghost onClick={() => go("login")}>← Back to sign in</Ghost></div>
        </div>
      )}

      {/* ── SIGNUP VERIFY ── */}
      {step === "signup-verify" && (
        <div className={cardCls}>
          <h1 className={headCls}>Verify and set a password</h1>
          <p className={subCls}>Enter the code sent to <span style={{ color: "var(--brand)" }} className="font-semibold">{f.email}</span></p>
          <form onSubmit={e => {
            e.preventDefault();
            const c = pwChecks(f.pw);
            if (!c.minLen || !c.hasUpper || !c.hasLower || !c.hasNum) { setError("Password does not meet the requirements below"); return; }
            wrap(async () => {
              await api.post("/auth/complete-signup", { name: f.name, email: f.email, otp: f.otp, password: f.pw });
              toast.success("Account created — redirecting to sign in…");
              setTimeout(() => go("login"), 1500);
            });
          }}>
            <div className="flex flex-col gap-4">
              {error && <Msg type="error" text={error} />}
              {success && <Msg type="ok" text={success} />}
              <div>
                <Label text="6-digit code" required />
                <Input placeholder="123456" maxLength={6} value={f.otp} onChange={up("otp")} required className="font-mono tracking-[0.15em] text-base font-bold" />
              </div>
              <div>
                <Label text="Set password" required />
                <Input type={showPw ? "text" : "password"} placeholder="Min 8 characters" value={f.pw} onChange={up("pw")} required right={eyeBtn} />
                <PwChecklist pw={f.pw} />
              </div>
              <Btn loading={loading}>Complete setup</Btn>
            </div>
          </form>
          <div className="mt-3.5 flex gap-3.5">
            <Ghost onClick={() => go("login")}>← Back to sign in</Ghost>
            <Ghost onClick={() => go("signup-start")}>Resend code</Ghost>
          </div>
        </div>
      )}

      {/* ── FORGOT ── */}
      {step === "forgot" && (
        <div className={cardCls}>
          <h1 className={headCls}>Forgot password?</h1>
          <p className={subCls}>Enter your registered email to get a reset code</p>
          <form onSubmit={e => {
            e.preventDefault();
            const target = f.forgotEmail || f.email;
            if (!isEmailValid(target)) { setError("Please enter a valid email"); return; }
            wrap(async () => {
              await api.post("/auth/forgot-password", { email: target });
              setF(p => ({ ...p, forgotEmail: target }));
              toast.info("Reset code sent to your inbox.");
              go("reset");
            });
          }}>
            <div className="flex flex-col gap-4">
              {error && <Msg type="error" text={error} />}
              {success && <Msg type="ok" text={success} />}
              <div><Label text="Account email" required /><Input icon={Mail} type="email" placeholder="you@example.com" value={f.forgotEmail || f.email} onChange={up("forgotEmail")} required isValid={f.forgotEmail ? isEmailValid(f.forgotEmail) : undefined} /></div>
              <Btn loading={loading}>Send reset code</Btn>
            </div>
          </form>
          <div className="mt-3.5 flex gap-3.5">
            <Ghost onClick={() => go("login")}>← Back to sign in</Ghost>
            <Ghost onClick={() => go("reset")}>Already have a code?</Ghost>
          </div>
        </div>
      )}

      {/* ── RESET ── */}
      {step === "reset" && (
        <div className={cardCls}>
          <h1 className={headCls}>Set a new password</h1>
          <p className={subCls}>Enter the reset code sent to your email</p>
          <form onSubmit={e => {
            e.preventDefault();
            const target = f.forgotEmail || f.email;
            const c = pwChecks(f.resetPw);
            if (!c.minLen || !c.hasUpper || !c.hasLower || !c.hasNum) { setError("Password does not meet the requirements below"); return; }
            wrap(async () => {
              await api.post("/auth/reset-password", { email: target, reset_code: f.resetCode, password: f.resetPw });
              toast.success("Password updated — redirecting to sign in…");
              setTimeout(() => go("login"), 1500);
            });
          }}>
            <div className="flex flex-col gap-4">
              {error && <Msg type="error" text={error} />}
              {success && <Msg type="ok" text={success} />}
              <div><Label text="Account email" required /><Input icon={Mail} type="email" placeholder="you@example.com" value={f.forgotEmail || f.email} onChange={up("forgotEmail")} required /></div>
              <div><Label text="6-digit reset code" required /><Input placeholder="123456" maxLength={6} value={f.resetCode} onChange={up("resetCode")} required className="font-mono tracking-[0.15em] text-base font-bold" /></div>
              <div>
                <Label text="New password" required />
                <Input type={showPw ? "text" : "password"} placeholder="Min 8 characters" value={f.resetPw} onChange={up("resetPw")} required right={eyeBtn} />
                <PwChecklist pw={f.resetPw} />
              </div>
              <Btn loading={loading}>Update password</Btn>
            </div>
          </form>
          <div className="mt-3.5 flex gap-3.5">
            <Ghost onClick={() => go("login")}>← Back to sign in</Ghost>
            <Ghost onClick={() => go("forgot")}>Resend code</Ghost>
          </div>
        </div>
      )}

      {/* ── INVITE ── */}
      {step === "invite" && (
        <div className={cardCls}>
          <h1 className={headCls}>Join a workspace</h1>
          <p className={subCls}>Activate your account with your invite code</p>
          <form onSubmit={e => {
            e.preventDefault();
            const c = pwChecks(f.invPw);
            if (!c.minLen || !c.hasUpper || !c.hasLower || !c.hasNum) { setError("Password does not meet the requirements below"); return; }
            wrap(async () => {
              await api.post("/auth/verify-invite", { email: f.invEmail, invite_code: f.invCode, password: f.invPw });
              toast.success("Account activated — redirecting to sign in…");
              setTimeout(() => go("login"), 1500);
            });
          }}>
            <div className="flex flex-col gap-4">
              {error && <Msg type="error" text={error} />}
              {success && <Msg type="ok" text={success} />}
              <div><Label text="Your email" required /><Input icon={Mail} type="email" placeholder="you@example.com" value={f.invEmail} onChange={up("invEmail")} required isValid={f.invEmail ? isEmailValid(f.invEmail) : undefined} /></div>
              <div><Label text="Invite code" required /><Input placeholder="ABC123" maxLength={6} value={f.invCode} onChange={e => setF(p => ({ ...p, invCode: e.target.value.toUpperCase() }))} required className="font-mono tracking-[0.2em] text-base font-bold" /></div>
              <div>
                <Label text="Set password" required />
                <Input type={showPw ? "text" : "password"} placeholder="Min 8 characters" value={f.invPw} onChange={up("invPw")} required right={eyeBtn} />
                <PwChecklist pw={f.invPw} />
              </div>
              <Btn loading={loading}>Activate account</Btn>
            </div>
          </form>
          <div className="mt-3.5"><Ghost onClick={() => go("login")}>← Back to sign in</Ghost></div>
        </div>
      )}
    </>
  );
}
