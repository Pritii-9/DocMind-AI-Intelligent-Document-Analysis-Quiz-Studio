/* eslint-disable @typescript-eslint/no-unused-vars */
import { createContext, useContext, useState } from "react";
import api from "../api/axios";

type AuthContextType = {
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  verifyOtp: (email: string, otp: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>(null!);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  // Use 'access_token' consistently
  const [token, setToken] = useState(localStorage.getItem("access_token"));

  const login = async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    const accessToken = res.data.access_token;
    
    localStorage.setItem("access_token", accessToken);
    setToken(accessToken);
  };

  const register = async (email: string, password: string) => {
    await api.post("/auth/register", { email, password });
  };

  const verifyOtp = async (email: string, otp: string) => {
    await api.post("/auth/verify-otp", { email, otp });
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    setToken(null);
    window.location.href = "/"; // Force redirect on logout
  };

  return (
    <AuthContext.Provider value={{ token, login, register, verifyOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};