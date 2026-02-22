import { createContext, useContext, useState } from "react";
import api from "../api/axios";

type AuthContextType = {
  token: string | null;
  role: string | null;
  userName: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  verifyOtp: (email: string, otp: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>(null!);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  // Sync state with localStorage on initialization
  const [token, setToken] = useState(localStorage.getItem("access_token"));
  const [role, setRole] = useState(localStorage.getItem("user_role"));
  const [userName, setUserName] = useState(localStorage.getItem("user_name"));

  const login = async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    
    // De-structure the new unified response fields
    const { access_token, role, name } = res.data;
    
    localStorage.setItem("access_token", access_token);
    localStorage.setItem("user_role", role);
    localStorage.setItem("user_name", name);
    
    setToken(access_token);
    setRole(role);
    setUserName(name);
  };

  const register = async (name: string, email: string, password: string) => {
    // Now sending 'name' to the backend for the unified signup
    await api.post("/auth/register", { name, email, password });
  };

  const verifyOtp = async (email: string, otp: string) => {
    await api.post("/auth/verify-otp", { email, otp });
  };

  const logout = () => {
    localStorage.clear(); // Clears token, role, and name
    setToken(null);
    setRole(null);
    setUserName(null);
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider value={{ token, role, userName, login, register, verifyOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};