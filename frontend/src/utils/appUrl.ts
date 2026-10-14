/**
 * URL Utilities for HireMind AI
 * Resolves the public deployment URL for candidate application portals.
 */

export const PRODUCTION_FRONTEND_URL = "https://hiremind-ai-gules.vercel.app";

/**
 * Returns the public candidate application portal URL.
 * Priority:
 * 1. Explicit environment variable: VITE_PUBLIC_APPLY_URL
 * 2. If running in production (Vercel, custom domain), uses window.location.origin
 * 3. If running locally (localhost / 127.0.0.1), defaults to the live deployed Vercel URL
 *    so shared links can immediately be sent to candidates.
 */
export function getPublicApplyUrl(roleId?: string, forceLocal?: boolean): string {
  const envUrl = import.meta.env.VITE_PUBLIC_APPLY_URL;
  if (envUrl && !forceLocal) {
    const base = envUrl.replace(/\/apply\/?$/, "");
    return roleId ? `${base}/apply?role=${encodeURIComponent(roleId)}` : `${base}/apply`;
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const isLocal = !origin || origin.includes("localhost") || origin.includes("127.0.0.1");

  const base = forceLocal || !isLocal ? origin : PRODUCTION_FRONTEND_URL;
  return roleId ? `${base}/apply?role=${encodeURIComponent(roleId)}` : `${base}/apply`;
}
