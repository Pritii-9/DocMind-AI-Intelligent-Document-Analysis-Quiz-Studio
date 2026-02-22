import { useState } from "react";
import api from "../api/axios";
import { X, UserPlus, Mail, User } from "lucide-react";

export default function InviteModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/invite-member", { name, email });
      alert("Invitation sent successfully!");
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.msg || "Failed to send invitation");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 p-8 relative animate-in fade-in zoom-in duration-200">
        <button onClick={onClose} className="absolute right-6 top-6 text-slate-400 hover:text-slate-600 transition-colors">
          <X size={24} />
        </button>

        <div className="mb-8">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl flex items-center justify-center mb-4">
            <UserPlus size={24} />
          </div>
          <h2 className="text-2xl font-black dark:text-white">Invite Team Member</h2>
          <p className="text-slate-500 text-sm mt-1">They will receive an email to set up their password.</p>
        </div>

        <form onSubmit={handleInvite} className="space-y-5">
          <div className="relative group">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
            <input 
              required
              className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500" 
              placeholder="Full Name" 
              onChange={(e) => setName(e.target.value)} 
            />
          </div>

          <div className="relative group">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
            <input 
              required
              type="email"
              className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500" 
              placeholder="Email Address" 
              onChange={(e) => setEmail(e.target.value)} 
            />
          </div>

          <button 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-200 transition-all active:scale-95 disabled:bg-slate-300"
          >
            {loading ? "Sending..." : "SEND INVITATION"}
          </button>
        </form>
      </div>
    </div>
  );
}