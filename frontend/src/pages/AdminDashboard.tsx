/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import InviteModal from "../components/InviteModal";
import api from "../api/axios";
import { Users, UserPlus, ShieldAlert, ShieldCheck, Loader2 } from "lucide-react";

export default function AdminDashboard() {
  const { userName } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get("/auth/users");
      setUsers(res.data);
    } catch (err) {
      console.error("Fetch error", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (userId: string, name: string, isActive: boolean) => {
    const action = isActive ? "deactivate" : "activate";
    if (!window.confirm(`Are you sure you want to ${action} ${name}?`)) return;
    
    try {
      await api.post(`/auth/users/${userId}/status`);
      fetchUsers(); 
    } catch (err: any) {
      alert(err.response?.data?.msg || "Failed to update status");
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      <Sidebar onSelectFile={() => {}} activeFile="" />
      <InviteModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); fetchUsers(); }} />

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 px-8 flex items-center justify-between">
          <h1 className="text-xl font-bold dark:text-white">Management Center</h1>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full uppercase">
             Admin: {userName}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h3 className="text-lg font-bold dark:text-white">Team Members</h3>
                <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-200 dark:shadow-none">
                  <UserPlus size={18} /> Invite Member
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                    <tr>
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {loading ? (
                      <tr><td colSpan={4} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-500" /></td></tr>
                    ) : (
                      users.map((user) => (
                        <tr key={user._id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${!user.is_active ? 'opacity-60 bg-slate-50/50' : ''}`}>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold dark:text-white">{user.name}</span>
                              <span className="text-xs text-slate-400">{user.email}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${user.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`font-bold text-sm ${user.is_active ? 'text-green-500' : 'text-red-500'}`}>
                              {user.is_active ? (user.verified ? 'Active' : 'Pending') : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button 
                              onClick={() => handleToggleStatus(user._id, user.name, user.is_active)} 
                              className={`p-2 rounded-lg transition-all ${user.is_active ? 'text-slate-400 hover:text-red-500 hover:bg-red-50' : 'text-green-500 hover:bg-green-50'}`}
                              title={user.is_active ? "Deactivate" : "Activate"}
                            >
                              {user.is_active ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}