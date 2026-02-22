/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Eye, EyeOff, Mail, Lock, KeyRound } from "lucide-react"; // Recommended for professional icons

export default function Login() {
  const { login, register, verifyOtp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [view, setView] = useState<"login" | "signup" | "otp">("login");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAction = async (actionFn: () => Promise<any>, nextView?: "login" | "otp") => {
    setLoading(true);
    setMessage("");
    try {
      await actionFn();
      if (nextView) setView(nextView);
    } catch (err: any) {
      setMessage(err.response?.data?.msg || "Action failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Professional Input Styling with Dark Mode Support
  const inputClass = "w-full pl-11 pr-12 py-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all placeholder:text-gray-400 shadow-sm";

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-6">
      {/* Increased width to max-w-lg for a more substantial, professional feel */}
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 shadow-2xl rounded-[2rem] border border-gray-100 dark:border-slate-800 p-10 lg:p-14 transition-all">
        
        <div className="text-center mb-10">
          <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-3 uppercase tracking-tight">
            {view === 'otp' ? 'Verification' : view}
          </h2>
          <p className="text-gray-500 dark:text-slate-400 font-medium">
            {view === 'login' && 'Welcome back. Please enter your details.'}
            {view === 'signup' && 'Create your secure account to get started.'}
            {view === 'otp' && `We've sent a code to your email.`}
          </p>
        </div>

        {message && (
          <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-semibold rounded-xl border border-red-100 dark:border-red-900/30 text-center animate-shake">
            {message}
          </div>
        )}

        <div className="flex flex-col gap-6">
          {/* Email Input */}
          <div className="relative group">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              className={inputClass} 
              placeholder="Email Address" 
              type="email"
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)} 
            />
          </div>

          {/* Password Input with Eye Toggle */}
          {view !== "otp" && (
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              <input 
                className={inputClass} 
                placeholder="Password" 
                type={showPassword ? "text" : "password"} 
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)} 
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          )}

          {/* OTP Input */}
          {view === "otp" && (
            <div className="relative group">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-orange-500 transition-colors" />
              <input 
                className={`${inputClass} text-center tracking-[0.5em] font-mono font-bold text-2xl !pl-4 !pr-4`} 
                placeholder="000000" 
                maxLength={6}
                onChange={(e) => setOtp(e.target.value)} 
              />
            </div>
          )}

          {/* Enhanced Action Buttons */}
          <div className="mt-4">
            {view === "login" && (
              <button 
                disabled={loading} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl transition-all active:scale-[0.98] shadow-xl shadow-blue-200 dark:shadow-none disabled:bg-gray-400" 
                onClick={() => handleAction(() => login(email, password))}
              >
                {loading ? "Authenticating..." : "SIGN IN"}
              </button>
            )}
            {view === "signup" && (
              <button 
                disabled={loading} 
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl transition-all active:scale-[0.98] shadow-xl shadow-indigo-200 dark:shadow-none disabled:bg-gray-400" 
                onClick={() => handleAction(() => register(email, password), "otp")}
              >
                {loading ? "Creating Account..." : "GET STARTED"}
              </button>
            )}
            {view === "otp" && (
              <button 
                disabled={loading} 
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-2xl transition-all active:scale-[0.98] shadow-xl shadow-orange-200 dark:shadow-none disabled:bg-gray-400" 
                onClick={() => handleAction(() => verifyOtp(email, otp), "login")}
              >
                {loading ? "Verifying..." : "CONFIRM CODE"}
              </button>
            )}
          </div>
          
          <button 
            onClick={() => setView(view === "login" ? "signup" : "login")} 
            className="text-center text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors mt-2 uppercase tracking-widest"
          >
            {view === "login" ? "Don't have an account ? Sign Up" : "Back to login"}
          </button>
        </div>
      </div>
    </div>
  );
}