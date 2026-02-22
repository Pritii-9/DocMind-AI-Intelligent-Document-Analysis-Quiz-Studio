/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { Eye, EyeOff, Mail, Lock, User, ShieldCheck, Ticket } from "lucide-react";

export default function Login() {
  const { login, register } = useAuth();
  const [view, setView] = useState<"login" | "signup" | "invite">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAction = async (actionFn: () => Promise<any>) => {
    setLoading(true);
    setMessage("");
    try {
      await actionFn();
      if (view === "signup") alert("Check email for OTP");
      if (view === "invite") {
        alert("Account activated!");
        setView("login");
      }
    } catch (err: any) {
      setMessage(err.response?.data?.msg || "Action failed.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full pl-11 pr-12 py-4 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all";

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 shadow-2xl rounded-[2.5rem] p-10 lg:p-14 border border-slate-100 dark:border-slate-800 transition-all">
        
        <div className="text-center mb-10">
          <div className="inline-flex p-3 rounded-2xl bg-blue-600 text-white mb-4 shadow-lg">
            <ShieldCheck size={32} />
          </div>
          <h2 className="text-3xl font-black dark:text-white uppercase tracking-tight">
            {view === 'invite' ? 'Join Team' : view}
          </h2>
        </div>

        {message && <div className="mb-6 p-4 bg-red-50 text-red-600 text-sm font-bold rounded-xl text-center">{message}</div>}

        <div className="flex flex-col gap-6">
          {view !== "login" && (
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input className={inputClass} placeholder="Full Name" onChange={(e) => setName(e.target.value)} />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input className={inputClass} placeholder="Email Address" type="email" onChange={(e) => setEmail(e.target.value)} />
          </div>

          {view === "invite" && (
            <div className="relative">
              <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                className={`${inputClass} text-center tracking-widest font-black uppercase`} 
                placeholder="INVITE CODE" 
                maxLength={6}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())} 
              />
            </div>
          )}

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input className={inputClass} placeholder={view === 'invite' ? "Set Password" : "Password"} type={showPassword ? "text" : "password"} onChange={(e) => setPassword(e.target.value)} />
            <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <button 
            disabled={loading} 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 disabled:bg-gray-400 transition-all"
            onClick={() => {
              if (view === "login") handleAction(() => login(email, password));
              if (view === "signup") handleAction(() => register(name, email, password));
              if (view === "invite") handleAction(() => api.post("/auth/verify-invite", { email, invite_code: inviteCode, password }));
            }}
          >
            {loading ? "Processing..." : view === 'invite' ? 'ACTIVATE ACCOUNT' : 'CONTINUE'}
          </button>
          
          <button onClick={() => setView(view === "login" ? "signup" : "login")} className="text-sm font-bold text-blue-600 hover:underline">
            {view === "login" ? "Create an account" : "Back to login"}
          </button>

          {view === "login" && (
            <button onClick={() => setView("invite")} className="text-sm font-bold text-slate-500 hover:text-blue-600">
              Have an invite code? Join Team
            </button>
          )}
        </div>
      </div>
    </div>
  );
}