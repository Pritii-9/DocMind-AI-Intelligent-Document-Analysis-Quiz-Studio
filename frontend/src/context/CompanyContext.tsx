import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../api/client";

export interface CompanyBranding {
  name: string;
  tagline: string;
  logoUrl: string | null; // Data URL (base64) or remote image URL
  websiteUrl: string;
}

export const DEFAULT_BRANDING: CompanyBranding = {
  name: "HireMind AI",
  tagline: "Autonomous Tech Candidate Screening & Intelligence",
  logoUrl: null,
  websiteUrl: "https://hiremind-ai-gules.vercel.app",
};

export const BRANDING_PRESETS: { label: string; branding: CompanyBranding }[] = [
  {
    label: "HireMind AI (Default)",
    branding: DEFAULT_BRANDING,
  },
  {
    label: "Stripe",
    branding: {
      name: "Stripe",
      tagline: "Financial Infrastructure for the Internet",
      logoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg",
      websiteUrl: "https://stripe.com",
    },
  },
  {
    label: "Vercel",
    branding: {
      name: "Vercel",
      tagline: "Develop. Preview. Ship. Next-Gen Cloud Platform",
      logoUrl: "https://assets.vercel.com/image/upload/front/favicon/vercel/180x180.png",
      websiteUrl: "https://vercel.com",
    },
  },
  {
    label: "Linear",
    branding: {
      name: "Linear",
      tagline: "Purpose-Built Tool for High-Velocity Product Teams",
      logoUrl: "https://linear.app/static/apple-touch-icon.png",
      websiteUrl: "https://linear.app",
    },
  },
];

interface CompanyContextType {
  branding: CompanyBranding;
  updateBranding: (updates: Partial<CompanyBranding>) => Promise<void>;
  resetBranding: () => Promise<void>;
  applyPreset: (preset: CompanyBranding) => Promise<void>;
}

const STORAGE_KEY = "hiremind_company_branding";
const CompanyContext = createContext<CompanyContextType | null>(null);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<CompanyBranding>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...DEFAULT_BRANDING, ...JSON.parse(saved) };
    } catch (e) {
      console.warn("Could not parse saved branding:", e);
    }
    return DEFAULT_BRANDING;
  });

  // Fetch server branding on mount
  useEffect(() => {
    let isMounted = true;
    api
      .get("/auth/branding")
      .then(({ data }) => {
        if (!isMounted || !data) return;
        const serverBranding: CompanyBranding = {
          name: data.name || DEFAULT_BRANDING.name,
          tagline: data.tagline || DEFAULT_BRANDING.tagline,
          logoUrl: data.logo_url || null,
          websiteUrl: data.website_url || "",
        };
        // If server has custom branding, prioritize it
        if (data.name && data.name !== "HireMind AI") {
          setBranding(serverBranding);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(serverBranding));
          } catch (e) {}
        }
      })
      .catch(() => {
        // Fallback to local storage if API is offline
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Listen to cross-tab storage updates
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          setBranding({ ...DEFAULT_BRANDING, ...JSON.parse(e.newValue) });
        } catch (err) {}
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const persistBranding = useCallback(async (newBranding: CompanyBranding) => {
    setBranding(newBranding);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newBranding));
    } catch (e) {}

    // Synchronize to backend if authenticated
    try {
      await api.patch("/auth/branding", {
        name: newBranding.name,
        tagline: newBranding.tagline,
        logo_url: newBranding.logoUrl,
        website_url: newBranding.websiteUrl,
      });
    } catch (err) {
      // Offline fallback: still saved locally in localStorage
    }
  }, []);

  const updateBranding = useCallback(
    async (updates: Partial<CompanyBranding>) => {
      const next = { ...branding, ...updates };
      await persistBranding(next);
    },
    [branding, persistBranding]
  );

  const resetBranding = useCallback(async () => {
    await persistBranding(DEFAULT_BRANDING);
  }, [persistBranding]);

  const applyPreset = useCallback(
    async (preset: CompanyBranding) => {
      await persistBranding(preset);
    },
    [persistBranding]
  );

  return (
    <CompanyContext.Provider value={{ branding, updateBranding, resetBranding, applyPreset }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used within a CompanyProvider");
  return ctx;
}
