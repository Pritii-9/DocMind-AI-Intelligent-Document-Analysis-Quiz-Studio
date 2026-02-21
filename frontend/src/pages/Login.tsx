/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, register, verifyOtp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [view, setView] = useState<"login" | "signup" | "otp">("login");
  const [message, setMessage] = useState("");

  const handleLogin = async () => {
    try {
      await login(email, password);
      // Refresh or redirect happens via AuthContext state update
    } catch (err: any) {
      setMessage(err.response?.data?.msg || "Login failed");
    }
  };

  return (
    <div className="p-10 flex flex-col gap-4 max-w-md mx-auto bg-white shadow-lg rounded-lg mt-10">
      <h2 className="text-2xl font-bold uppercase text-center border-b pb-2">{view}</h2>
      {message && <p className="text-red-500 text-center text-sm">{message}</p>}

      <input className="border p-2 rounded" placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
      {view !== "otp" && (
        <input className="border p-2 rounded" placeholder="Password" type="password" onChange={(e) => setPassword(e.target.value)} />
      )}
      {view === "otp" && (
        <input className="border p-2 rounded" placeholder="6-digit OTP" onChange={(e) => setOtp(e.target.value)} />
      )}

      {view === "login" && <button className="bg-green-600 text-white p-2 rounded" onClick={handleLogin}>Login</button>}
      {view === "signup" && <button className="bg-blue-600 text-white p-2 rounded" onClick={() => register(email, password).then(() => setView("otp"))}>Send OTP</button>}
      {view === "otp" && <button className="bg-orange-500 text-white p-2 rounded" onClick={() => verifyOtp(email, otp).then(() => setView("login"))}>Verify OTP</button>}
      
      <p onClick={() => setView(view === "login" ? "signup" : "login")} className="text-center text-sm cursor-pointer hover:underline text-gray-600">
        {view === "login" ? "Need an account? Signup" : "Back to Login"}
      </p>
    </div>
  );
}