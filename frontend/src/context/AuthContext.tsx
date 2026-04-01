/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState } from "react";

import api from "../api/axios";

type AuthContextType = {
  token: string | null;
  role: string | null;
  userName: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  verifyOtp: (email: string, otp: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("access_token"));
  const [role, setRole] = useState<string | null>(() => localStorage.getItem("user_role"));
  const [userName, setUserName] = useState<string | null>(() => localStorage.getItem("user_name"));

  const login = async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    const { access_token, role: nextRole, name } = res.data;

    localStorage.setItem("access_token", access_token);
    localStorage.setItem("user_role", nextRole);
    localStorage.setItem("user_name", name);

    setToken(access_token);
    setRole(nextRole);
    setUserName(name);
  };

  const register = async (name: string, email: string, password: string) => {
    await api.post("/auth/register", { name, email, password });
  };

  const verifyOtp = async (email: string, otp: string) => {
    await api.post("/auth/verify-otp", { email, otp });
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_name");
    setToken(null);
    setRole(null);
    setUserName(null);
    window.location.hash = "";
  };

  const value = useMemo(
    () => ({
      token,
      role,
      userName,
      isAuthenticated: Boolean(token),
      login,
      register,
      verifyOtp,
      logout,
    }),
    [role, token, userName]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
