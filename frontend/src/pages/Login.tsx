import { 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Lock, 
  Mail, 
  ShieldCheck, 
  Ticket, 
  User, 
  HardDrive,   
  Sparkles,    
  RefreshCcw 
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import type { AxiosError } from "axios";

import api from "../api/axios";
import ThemeToggle from "../components/ThemeToggle";
import { useAuth } from "../context/AuthContext";

type ViewState = "login" | "signup" | "verify" | "invite" | "forgot" | "reset";

const titleMap: Record<ViewState, string> = {
  login: "Welcome back",
  signup: "Get started",
  verify: "Check your inbox",
  invite: "Join workspace",
  forgot: "Reset password",
  reset: "New password",
};

const subtitleMap: Record<ViewState, string> = {
  login: "Enter your credentials to access your secure documents.",
  signup: "Create an account to begin managing your team workspace.",
  verify: "We've sent a 6-digit code to your email address.",
  invite: "Enter your invitation code to activate your workspace access.",
  forgot: "Enter your email and we'll send you a recovery code.",
  reset: "Set a secure password for your workspace account.",
};

const primaryLabelMap: Record<ViewState, string> = {
  login: "Continue",
  signup: "Create Account",
  verify: "Verify Code",
  invite: "Join Workspace",
  forgot: "Send Code",
  reset: "Update Password",
};

export default function Login() {
  const { login } = useAuth();
  const [view, setView] = useState<ViewState>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteCode = params.get("invite");
    const paramEmail = params.get("email");
    if (inviteCode && paramEmail) {
      setView("invite");
      setCode(inviteCode);
      setEmail(paramEmail);
    }
  }, []);

  const isError = useMemo(() => {
    const value = (message || "").toLowerCase();
    return ["failed", "invalid", "required", "expired", "exists"].some(kw => value.includes(kw));
  }, [message]);

  const switchView = (next: ViewState) => {
    setView(next);
    setMessage(null);
    setPassword("");
    if (next !== "verify" && next !== "invite" && next !== "reset") {
      setCode("");
    }
  };

  const handleAction = async (action: () => Promise<unknown>) => {
    setLoading(true);
    setMessage(null);
    try {
      await action();
      if (view === "signup") setView("verify");
      else if (view === "forgot") setView("reset");
      else if (["verify", "invite", "reset"].includes(view)) {
        setView("login");
        setMessage("Success. You can now sign in.");
      }
    } catch (err: unknown) {
      const axiosError = err as AxiosError<{ msg?: string }>;
      setMessage(axiosError.response?.data?.msg || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const submit = () => {
    if (view === "login") void handleAction(() => login(email, password));
    else if (view === "signup") void handleAction(() => api.post("/auth/start-signup", { name, email }));
    else if (view === "verify") void handleAction(() => api.post("/auth/complete-signup", { name, email, otp: code, password }));
    else if (view === "invite") void handleAction(() => api.post("/auth/verify-invite", { name, email, invite_code: code, password }));
    else if (view === "forgot") void handleAction(() => api.post("/auth/forgot-password", { email }));
    else if (view === "reset") void handleAction(() => api.post("/auth/reset-password", { email, reset_code: code, password }));
  };

  return (
    <div className="flex min-h-screen w-full bg-[var(--workspace-shell)] text-[var(--text-strong)] transition-colors duration-300">
      
      {/* BRANDED HEADER - Floats above everything */}
      <nav className="absolute top-0 left-0 z-50 w-full px-8 py-6">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--accent)] to-cyan-600 shadow-lg shadow-cyan-500/20 font-bold text-white">
              S
            </div>
            <div>
              <span className="font-display text-xl font-bold tracking-tight text-[var(--text-strong)] leading-none">
                SafeUp
              </span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      {/* Left Panel - Narrative */}
      <div className="hidden lg:flex w-1/2 flex-col justify-center bg-[var(--workspace-shell)] px-16 xl:px-24">
        <div className="max-w-xl mx-auto w-full animate-in fade-in slide-in-from-left-8 duration-700 mt-16">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--workspace-divider)] bg-[var(--workspace-frame)] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--accent)]">
            <ShieldCheck size={14} />
            Enterprise Document Security
          </div>
          <h1 className="font-display text-4xl font-bold leading-[1.1] text-[var(--text-strong)] xl:text-6xl">
            Stream documents with <br /> 
            <span className="text-[var(--accent)]">absolute control</span>
          </h1>
          <p className="mt-8 max-w-md text-lg leading-relaxed text-[var(--text-soft)]">
            SafeUp provides workspace isolation and protected PDF delivery for modern teams. Secure, fast, and entirely audited.
          </p>
          
          <div className="mt-12 grid grid-cols-2 gap-6">
            {[
              { label: "Storage", val: "S3 Encrypted", icon: HardDrive },
              { label: "Sync", val: "Real-time SSE", icon: Sparkles },
            ].map((feat) => (
              <div key={feat.label} className="flex items-center gap-4 rounded-xl border border-[var(--workspace-divider)] bg-[var(--workspace-frame)] p-4 shadow-sm">
                <div className="rounded-xl bg-[var(--accent-soft)] p-2 text-[var(--accent)]">
                  <feat.icon size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-soft)]">{feat.label}</p>
                  <p className="text-sm font-bold text-[var(--text-strong)]">{feat.val}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex w-full lg:w-1/2 flex-col justify-center bg-white dark:bg-[var(--panel-solid)] px-6 sm:px-12 md:px-20 lg:px-24 relative shadow-2xl lg:shadow-[0_0_60px_-15px_rgba(0,0,0,0.1)]">
        
        <div className="w-full max-w-[420px] mx-auto animate-in fade-in slide-in-from-right-8 duration-700 mt-20 lg:mt-0">
          <div className="mb-10">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
              {titleMap[view]}
            </h2>
            <p className="mt-2 text-sm text-[var(--text-soft)] leading-relaxed">
              {subtitleMap[view]}
            </p>
          </div>

          {message && (
            <div className={`mb-6 rounded-lg border px-4 py-3 text-xs font-bold ${
              isError ? "border-rose-500/20 bg-rose-500/10 text-rose-500" 
                      : "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
            }`}>
              {message}
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <div className="space-y-6">
              {["signup", "verify", "invite"].includes(view) && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[var(--text-strong)] px-1 block">Full name</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-soft)] group-focus-within:text-[var(--accent)] transition-colors" size={18} />
                    <input 
                      className="w-full rounded-lg border border-[var(--workspace-divider)] bg-[var(--workspace-input)] py-3 pl-12 pr-4 text-sm text-[var(--text-strong)] outline-none transition-all focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                      placeholder="Ananya Sharma"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--text-strong)] px-1 block">Email address</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-soft)] group-focus-within:text-[var(--accent)] transition-colors" size={18} />
                  <input 
                    className="w-full rounded-lg border border-[var(--workspace-divider)] bg-[var(--workspace-input)] py-3 pl-12 pr-4 text-sm text-[var(--text-strong)] outline-none transition-all focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                    placeholder="name@company.com"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {(view === "verify" || view === "invite" || view === "reset") && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[var(--text-strong)] px-1 block">
                    {view === "verify" ? "Verification code" : view === "invite" ? "Invitation code" : "Reset code"}
                  </label>
                  <div className="relative">
                    <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-soft)]" size={18} />
                    <input 
                      className="w-full rounded-lg border border-[var(--workspace-divider)] bg-[var(--workspace-input)] py-3 pl-12 text-center text-lg font-bold tracking-[0.5em] text-[var(--text-strong)] outline-none transition-all focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                      maxLength={6}
                      placeholder="000000"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                    />
                  </div>
                </div>
              )}

              {(view === "login" || view === "verify" || view === "invite" || view === "reset") && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-sm font-semibold text-[var(--text-strong)]">Password</label>
                    {view === "login" && (
                      <button type="button" onClick={() => switchView("forgot")} className="text-sm font-semibold text-[var(--accent)] hover:underline underline-offset-4">Forgot password?</button>
                    )}
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-soft)] group-focus-within:text-[var(--accent)] transition-colors" size={18} />
                    <input 
                      className="w-full rounded-lg border border-[var(--workspace-divider)] bg-[var(--workspace-input)] py-3 pl-12 pr-12 text-sm text-[var(--text-strong)] outline-none transition-all focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-soft)] hover:text-[var(--text-strong)] transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group mt-10 flex w-full items-center justify-center gap-3 rounded-lg bg-[var(--button-primary-bg)] py-3.5 text-sm font-bold text-[var(--button-primary-text)] shadow-lg shadow-[var(--accent)]/20 transition-all hover:bg-[var(--button-primary-hover)] disabled:opacity-50"
            >
              {loading ? <RefreshCcw className="animate-spin" size={18} /> : primaryLabelMap[view]}
              {!loading && <ArrowRight size={18} className="ml-1 transition-transform group-hover:translate-x-1" />}
            </button>
          </form>

          <div className="mt-8 border-t border-[var(--workspace-divider)] pt-6 text-center">
            {view === "login" ? (
              <div className="space-y-3">
                <p className="text-sm text-[var(--text-soft)]">
                  Need a workspace?{" "}
                  <button type="button" onClick={() => switchView("signup")} className="font-bold text-[var(--text-strong)] hover:text-[var(--accent)] transition-colors">Create account</button>
                </p>
                <p className="text-sm text-[var(--text-soft)]">
                  Have an invite code?{" "}
                  <button type="button" onClick={() => switchView("invite")} className="font-bold text-[var(--text-strong)] hover:text-[var(--accent)] transition-colors">Join workspace</button>
                </p>
              </div>
            ) : (
              <button onClick={() => switchView("login")} className="text-sm font-bold text-[var(--text-soft)] hover:text-[var(--text-strong)] transition-colors inline-flex items-center gap-2 mx-auto">
                Back to login
              </button>
            )}
          </div>
          
          <p className="mt-12 text-center text-xs font-bold uppercase tracking-widest text-[var(--text-soft)] opacity-40">
            &copy; 2026 SafeUp Systems Inc.
          </p>
        </div>
      </div>
    </div>
  );
}
