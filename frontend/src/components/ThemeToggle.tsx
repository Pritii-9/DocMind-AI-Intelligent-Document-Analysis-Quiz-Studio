import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

function getInitialTheme(): ThemeMode {
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") {
    return saved;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);

    // Force a repaint to ensure CSS variables are applied immediately
    html.style.display = 'none';
    html.offsetHeight; // Trigger reflow
    html.style.display = '';
  }, [theme]);

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 p-1 backdrop-blur">
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={`rounded-full p-2 transition ${theme === "light" ? "bg-[var(--accent)] text-white" : "text-cyan-100/60 hover:text-white"}`}
        aria-label="Use light theme"
        title="Light theme"
      >
        <Sun size={16} />
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={`rounded-full p-2 transition ${theme === "dark" ? "bg-[var(--accent)] text-white" : "text-cyan-100/60 hover:text-white"}`}
        aria-label="Use dark theme"
        title="Dark theme"
      >
        <Moon size={16} />
      </button>
    </div>
  );
}
