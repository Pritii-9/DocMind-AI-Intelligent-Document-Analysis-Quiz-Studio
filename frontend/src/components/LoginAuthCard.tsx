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

function Label({ text, required, htmlFor }: { text: string; required?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-[11px] font-medium text-slate-700 mb-1">
      {text}{required && <span className="text-red-500"> *</span>}
    </label>
  );
}

function Input({ icon: Icon, isValid, right, className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement> & { icon?: any; isValid?: boolean; right?: React.ReactNode }) {
  return (
    <div className="relative">
      {Icon && <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />}
      <input
        className={[
          "w-full h-9 bg-white rounded-lg text-xs text-slate-900 outline-none transition-all duration-150 font-[inherit] placeholder:text-slate-400",
          "border",
          Icon ? "pl-8.5" : "pl-3",
          right ? "pr-9" : "pr-3",
          isValid === false
            ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100"
            : isValid === true
            ? "border-emerald-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            : "border-slate-200 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10",
          className,
        ].join(" ")}
        {...props}
      />
      {right && <div className="absolute right-2.5 top-1/2 -translate-y-1/2">{right}</div>}
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
    <div className="mt-1.5 grid grid-cols-2 gap-1 p-2 bg-slate-50 rounded-lg border border-slate-200">
      {items.map((item, i) => (
        <div key={i} className={`flex items-center gap-1.5 text-[10.5px] ${item.ok ? "text-emerald-700 font-semibold" : "text-slate-400"}`}>
          {item.ok ? <Check size={11} className="text-emerald-600" /> : <X size={11} className="text-slate-300" />}
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
        "w-full h-9 flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold font-[inherit] transition-all duration-150",
        off
          ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
          : "bg-slate-900 hover:bg-slate-800 active:bg-black text-white cursor-pointer active:scale-[0.99] shadow-xs",
      ].join(" ")}
    >
      {loading ? (
        <>
          <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full inline-block spin" />
          <span>Please wait…</span>
        </>
      ) : (
        <>{children}<ArrowRight size={13} /></>
      )}
    </button>
  );
}

function Ghost({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-transparent border-none py-1.5 text-xs text-slate-500 font-medium cursor-pointer font-[inherit] hover:text-slate-900 transition-colors"
    >
      {children}
    </button>
  );
}

function Msg({ type, text }: { type: "error" | "ok"; text: string }) {
  const isErr = type === "error";
  return (
    <div className={[
      "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium",
      isErr ? "bg-red-50 border border-red-200 text-red-700" : "bg-emerald-50 border border-emerald-200 text-emerald-700",
    ].join(" ")}>
      {isErr ? <X size={14} /> : <Check size={14} />}
      <span>{text}</span>
    </div>
  );
}

/* ── Main component ── */

export default function LoginAuthCard() {
  const { login, loginAsDemo } = useAuth();
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
      const msg = e.response?.data?.detail 
        || (e.code === "ERR_NETWORK" ? "Cloud server waking up. Please retry in a few seconds." : null)
        || e.message 
        || "Login failed. Please check credentials.";
      setError(msg); toast.error(msg);
    }
    finally { setLoading(false); }
  }

  const cardCls = "bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_4px_20px_rgb(0,0,0,0.04)]";
  const headCls = "text-base font-bold tracking-tight text-slate-900 mb-0.5";
  const subCls  = "text-[11.5px] text-slate-500";

  const eyeBtn = (
    <button
      type="button"
      onClick={() => setShowPw(!showPw)}
      aria-label={showPw ? "Hide password" : "Show password"}
      className="bg-transparent border-none cursor-pointer text-slate-400 flex hover:text-slate-600 transition-colors p-0.5"
    >
      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
    </button>
  );

  return (
    <>
      {/* ── LOGIN ── */}
      {step === "login" && (
        <div className={cardCls}>
          <div className="mb-3 text-center">
            <h1 className={headCls}>Welcome back</h1>
            <p className={subCls}>Sign in to your HireMind workspace</p>
          </div>

          {/* Highlighted Interactive Demo Button (Upper Side) */}
          <button
            type="button"
            onClick={() => {
              loginAsDemo();
              toast.success("Welcome! Exploring HireMind as Hiring Lead (Demo).");
            }}
            className="w-full flex items-center justify-between p-2.5 mb-3 rounded-xl bg-gradient-to-r from-indigo-50 via-purple-50/50 to-indigo-50 border border-indigo-200/90 hover:border-indigo-400 text-indigo-950 transition-all cursor-pointer shadow-xs active:scale-[0.99] group text-left"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
              </span>
              <div>
                <div className="text-[12px] font-bold text-indigo-950 flex items-center gap-1.5 leading-none mb-0.5">
                  <span>Interactive Recruiter Demo</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-indigo-600 text-white tracking-wide uppercase">
                    Live ATS
                  </span>
                </div>
                <div className="text-[10.5px] text-indigo-700/85 leading-none">Explore workspace without signing in</div>
              </div>
            </div>
            <div className="text-[11px] font-semibold text-indigo-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
              <span>Launch</span>
              <ArrowRight size={13} />
            </div>
          </button>

          <div className="relative mb-3 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200/80" /></div>
            <span className="relative bg-white px-2 text-[10px] font-medium text-slate-400 uppercase tracking-wider">or sign in with email</span>
          </div>

          <form onSubmit={e => {
            e.preventDefault();
            const cleanEmail = f.email.trim();
            if (!cleanEmail || !isEmailValid(cleanEmail)) { setError("Please enter a valid work email"); return; }
            if (!f.pw) { setError("Please enter your password"); return; }
            wrap(async () => {
              const { data } = await api.post("/auth/login", { email: cleanEmail, password: f.pw });
              login(data.access_token, data.name, data.role);
              toast.success(`Welcome back, ${data.name}!`);
            });
          }}>
            <div className="space-y-3">
              {error && <Msg type="error" text={error} />}
              <div>
                <Label text="Work email" required htmlFor="email" />
                <Input
                  id="email"
                  icon={Mail}
                  type="email"
                  placeholder="name@company.com"
                  value={f.email}
                  onChange={up("email")}
                  required
                  autoFocus
                  isValid={f.email ? isEmailValid(f.email.trim()) : undefined}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label text="Password" required htmlFor="password" />
                  <button
                    type="button"
                    onClick={() => go("forgot")}
                    className="bg-transparent border-none cursor-pointer text-[11px] font-medium text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="password"
                  icon={Lock}
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={f.pw}
                  onChange={up("pw")}
                  required
                  right={eyeBtn}
                />
              </div>
              <Btn loading={loading}>Sign in</Btn>
            </div>
          </form>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <button
              type="button"
              onClick={() => go("signup-start")}
              className="bg-transparent border-none cursor-pointer text-[11px] font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Create workspace
            </button>
            <span className="text-slate-300">•</span>
            <button
              type="button"
              onClick={() => go("invite")}
              className="bg-transparent border-none cursor-pointer text-[11px] font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Activate with invite code
            </button>
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
