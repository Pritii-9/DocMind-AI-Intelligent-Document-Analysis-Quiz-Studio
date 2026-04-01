import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck, Ticket, User } from "lucide-react";
import { useMemo, useState } from "react";

import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

type ViewState = "login" | "signup" | "verify" | "invite" | "forgot" | "reset";

const titleMap: Record<ViewState, string> = {
  login: "Welcome back",
  signup: "Create workspace",
  verify: "Verify and create account",
  invite: "Activate invite",
  forgot: "Recover access",
  reset: "Set a new password",
};

const subtitleMap: Record<ViewState, string> = {
  login: "Sign in with your existing account to access the secure workspace.",
  signup: "Start with your name and email, then verify your email before setting your password.",
  verify: "Enter the code sent to your email, then set your password to complete signup.",
  invite: "Use the invitation code shared by your administrator to join the workspace securely.",
  forgot: "Enter your email and we will send you a time-limited reset code.",
  reset: "Use the code from your email to choose a new password and get back into your workspace.",
};

const primaryLabelMap: Record<ViewState, string> = {
  login: "Login",
  signup: "Verify Email",
  verify: "Create Account",
  invite: "Join Workspace",
  forgot: "Send Reset Code",
  reset: "Reset Password",
};

function AuthModeTabs({
  view,
  onChange,
}: {
  view: ViewState;
  onChange: (view: ViewState) => void;
}) {
  const selected = view === "verify" ? "signup" : view === "reset" ? "forgot" : view;

  const tabs: Array<{ id: "login" | "signup" | "forgot"; label: string }> = [
    { id: "login", label: "Login" },
    { id: "signup", label: "Signup" },
    { id: "forgot", label: "Forgot Password" },
  ];

  return (
    <div className="mb-8 grid grid-cols-3 gap-2 rounded-2xl bg-[var(--panel-muted)] p-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
            selected === tab.id
              ? "bg-[var(--accent)] text-white shadow-sm"
              : "text-[var(--text-soft)] hover:text-[var(--text-strong)]"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default function Login() {
  const { login } = useAuth();
  const [view, setView] = useState<ViewState>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isError = useMemo(() => {
    const value = (message || "").toLowerCase();
    return (
      value.includes("failed") ||
      value.includes("invalid") ||
      value.includes("required") ||
      value.includes("expired") ||
      value.includes("exists")
    );
  }, [message]);

  const inputClass =
    "w-full rounded-2xl border border-black/5 bg-[var(--panel-muted)] px-4 py-3 pl-12 text-[var(--text-strong)] outline-none transition focus:border-[var(--accent)] dark:border-white/10";

  const resetLocalFields = () => {
    setPassword("");
    setOtp("");
    setResetCode("");
    setInviteCode("");
    setShowPassword(false);
    setMessage(null);
  };

  const switchView = (nextView: ViewState) => {
    setView(nextView);
    resetLocalFields();
  };

  const handleAction = async (action: () => Promise<unknown>) => {
    setLoading(true);
    setMessage(null);

    try {
      await action();
      if (view === "signup") {
        setView("verify");
        setMessage("Verification code sent. Enter the code below, then set your password.");
      } else if (view === "verify") {
        setView("login");
        setMessage("Account created successfully. You can login now.");
      } else if (view === "invite") {
        setView("login");
        setMessage("Invite accepted. You can login now.");
      } else if (view === "forgot") {
        setView("reset");
        setMessage("If your account exists, a reset code has been sent to your email.");
      } else if (view === "reset") {
        setView("login");
        setMessage("Password updated. You can login now.");
      }
    } catch (err) {
      if (typeof err === "object" && err !== null && "response" in err) {
        const response = (err as { response?: { data?: { msg?: string } } }).response;
        setMessage(response?.data?.msg || "Action failed.");
      } else {
        setMessage("Action failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const submitCurrentView = () => {
    if (view === "login") {
      void handleAction(() => login(email, password));
      return;
    }

    if (view === "signup") {
      void handleAction(() => api.post("/auth/start-signup", { name, email }));
      return;
    }

    if (view === "verify") {
      void handleAction(() =>
        api.post("/auth/complete-signup", {
          name,
          email,
          otp,
          password,
        })
      );
      return;
    }

    if (view === "invite") {
      void handleAction(() =>
        api.post("/auth/verify-invite", {
          email,
          invite_code: inviteCode,
          password,
        })
      );
      return;
    }

    if (view === "forgot") {
      void handleAction(() => api.post("/auth/forgot-password", { email }));
      return;
    }

    void handleAction(() =>
      api.post("/auth/reset-password", {
        email,
        reset_code: resetCode,
        password,
      })
    );
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--app-bg)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.18),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.12),_transparent_30%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-12 px-6 py-10 lg:flex-row lg:items-center lg:justify-between">
        <section className="max-w-2xl pt-6 lg:pt-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)] shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/60">
            <ShieldCheck size={14} />
            Resume-grade product case study
          </div>
          <h1 className="mt-6 font-display text-5xl font-semibold leading-tight text-[var(--text-strong)] sm:text-6xl">
            Secure document streaming for teams that care about trust, speed, and control.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--text-soft)]">
            SecureVault Pro combines protected PDF delivery, workspace isolation, onboarding automation, and operational dashboards into one polished platform you can confidently present to leadership.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              ["Multipart Uploads", "Reliable large-file transfer to S3 with progress tracking"],
              ["Executive Dashboard", "Operational KPIs, activity feed, and recent uploads"],
              ["Role-based Access", "Admin controls, invitations, and protected viewing"],
            ].map(([title, text]) => (
              <div key={title} className="rounded-3xl border border-black/5 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/60">
                <p className="font-display text-lg font-semibold text-[var(--text-strong)]">{title}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="w-full max-w-xl rounded-[2rem] border border-black/5 bg-[var(--panel)] p-8 shadow-2xl dark:border-white/10 sm:p-10">
          <AuthModeTabs view={view} onChange={switchView} />

          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Secure auth</p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-[var(--text-strong)]">
              {titleMap[view]}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">{subtitleMap[view]}</p>
          </div>

          {message ? (
            <div
              className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-medium ${
                isError
                  ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-200"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200"
              }`}
            >
              {message}
            </div>
          ) : null}

          <div className="space-y-4">
            {(view === "signup" || view === "verify" || view === "invite") && (
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--text-soft)]">
                  <User size={16} />
                  Full name
                </span>
                <div className="relative">
                  <User
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-soft)]"
                    size={18}
                  />
                  <input
                    className={inputClass}
                    placeholder="Ananya Sharma"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
              </label>
            )}

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--text-soft)]">
                <Mail size={16} />
                Email address
              </span>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-soft)]"
                  size={18}
                />
                <input
                  className={inputClass}
                  placeholder="you@company.com"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </label>

            {view === "verify" && (
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--text-soft)]">
                  <Ticket size={16} />
                  Verification code
                </span>
                <div className="relative">
                  <Ticket
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-soft)]"
                    size={18}
                  />
                  <input
                    className={`${inputClass} text-center text-lg font-semibold tracking-[0.4em]`}
                    placeholder="123456"
                    maxLength={6}
                    value={otp}
                    onChange={(event) => setOtp(event.target.value)}
                  />
                </div>
              </label>
            )}

            {view === "invite" && (
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--text-soft)]">
                  <Ticket size={16} />
                  Invitation code
                </span>
                <div className="relative">
                  <Ticket
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-soft)]"
                    size={18}
                  />
                  <input
                    className={`${inputClass} text-center text-lg font-semibold tracking-[0.35em] uppercase`}
                    placeholder="AB12CD"
                    maxLength={6}
                    value={inviteCode}
                    onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                  />
                </div>
              </label>
            )}

            {view === "reset" && (
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--text-soft)]">
                  <Ticket size={16} />
                  Reset code
                </span>
                <div className="relative">
                  <Ticket
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-soft)]"
                    size={18}
                  />
                  <input
                    className={`${inputClass} text-center text-lg font-semibold tracking-[0.4em]`}
                    placeholder="123456"
                    maxLength={6}
                    value={resetCode}
                    onChange={(event) => setResetCode(event.target.value)}
                  />
                </div>
              </label>
            )}

            {(view === "login" || view === "verify" || view === "invite" || view === "reset") && (
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--text-soft)]">
                  <Lock size={16} />
                  Password
                </span>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-soft)]"
                    size={18}
                  />
                  <input
                    className={`${inputClass} pr-12`}
                    placeholder={
                      view === "verify" || view === "invite" || view === "reset"
                        ? "Create a strong password"
                        : "Enter your password"
                    }
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-soft)] transition hover:text-[var(--text-strong)]"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
            )}
          </div>

          <button
            type="button"
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={submitCurrentView}
          >
            {loading ? "Processing..." : primaryLabelMap[view]}
            <ArrowRight size={18} />
          </button>

          <div className="mt-6 flex flex-col gap-3 text-sm font-medium text-[var(--text-soft)]">
            {view === "login" && (
              <button
                type="button"
                onClick={() => switchView("invite")}
                className="text-left transition hover:text-[var(--accent)]"
              >
                Joining via invite code? Activate your access.
              </button>
            )}

            {(view === "verify" || view === "invite" || view === "reset") && (
              <button
                type="button"
                onClick={() => switchView("login")}
                className="text-left transition hover:text-[var(--accent)]"
              >
                Back to login
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
