/**
 * URL Utilities for HireMind AI
 * Resolves the public deployment URL for candidate application portals with company and role routing.
 */

export const PRODUCTION_FRONTEND_URL = "https://hiremind-ai-gules.vercel.app";

export interface ApplyUrlOptions {
  roleId?: string;
  companyName?: string;
  forceLocal?: boolean;
}

/**
 * Returns the public candidate application portal URL.
 * Supports company-wise and role-wise deep links (e.g. /apply?company=Acme+Corp&role=job-ai-engineer).
 */
export function getPublicApplyUrl(options?: ApplyUrlOptions | string, forceLocal?: boolean): string {
  let roleId: string | undefined;
  let companyName: string | undefined;
  let isLocalForced = forceLocal;

  if (typeof options === "string") {
    roleId = options;
  } else if (options && typeof options === "object") {
    roleId = options.roleId;
    companyName = options.companyName;
    if (options.forceLocal !== undefined) isLocalForced = options.forceLocal;
  }

  const envUrl = import.meta.env.VITE_PUBLIC_APPLY_URL;
  let base: string;

  if (envUrl && !isLocalForced) {
    base = envUrl.replace(/\/apply\/?$/, "");
  } else {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const isLocal = !origin || origin.includes("localhost") || origin.includes("127.0.0.1");
    base = isLocalForced || !isLocal ? origin : PRODUCTION_FRONTEND_URL;
  }

  const params = new URLSearchParams();
  if (companyName && companyName.trim() && companyName !== "HireMind AI") {
    params.set("company", companyName.trim());
  }
  if (roleId && roleId.trim()) {
    params.set("role", roleId.trim());
  }

  const queryString = params.toString();
  return queryString ? `${base}/apply?${queryString}` : `${base}/apply`;
}
