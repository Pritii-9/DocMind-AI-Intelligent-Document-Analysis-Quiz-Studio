import api from "../api/client";
import { PRODUCTION_FRONTEND_URL } from "./appUrl";

export interface ShareEvalResult {
  shareUrl: string;
  evalId: string;
  durationMinutes: number;
  expiresAt: Date;
}

/**
 * Creates a secure, time-bound candidate evaluation link (standard: 24 hours).
 * Features automatic dual-mode:
 * 1. Server-backed link: /eval?id={eval_id}
 * 2. Instant client-encoded token fallback: /eval?token={jwt/base64} for zero-cold-start reliability.
 */
export async function createShareableEvalLink(
  candidateData: any,
  durationMinutes: number = 1440 // 24 hours default
): Promise<ShareEvalResult> {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const isLocal = !origin || origin.includes("localhost") || origin.includes("127.0.0.1");
  const baseUrl = isLocal ? PRODUCTION_FRONTEND_URL : origin;

  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

  const b64Token = (() => {
    try {
      const payload = {
        candidate: candidateData,
        exp: expiresAt.getTime(),
        duration: durationMinutes,
      };
      const jsonStr = JSON.stringify(payload);
      return encodeURIComponent(btoa(encodeURIComponent(jsonStr)));
    } catch (e) {
      return "";
    }
  })();

  const encodePayload = () => {
    return b64Token
      ? `${baseUrl}/eval?token=${b64Token}`
      : `${baseUrl}/eval?duration=${durationMinutes}`;
  };

  try {
    const res = await api.post("/api/hire/create-share-eval", {
      candidate: candidateData,
      duration_minutes: durationMinutes,
    });

    if (res.data?.eval_id) {
      const shareUrl = b64Token
        ? `${baseUrl}/eval?id=${res.data.eval_id}&token=${b64Token}`
        : `${baseUrl}/eval?id=${res.data.eval_id}`;
      return {
        shareUrl,
        evalId: res.data.eval_id,
        durationMinutes,
        expiresAt: new Date(res.data.expires_at || expiresAt),
      };
    }
  } catch (err) {
    console.warn("API share link fallback to client token:", err);
  }

  // Resilient fallback: baked client token
  return {
    shareUrl: encodePayload(),
    evalId: `client-${Date.now()}`,
    durationMinutes,
    expiresAt,
  };
}

/**
 * Decodes client-encoded token if server ID is not used or server is unreachable.
 */
export function decodeClientEvalToken(token: string): {
  candidate: any;
  expired: boolean;
  expiresAt: Date;
  durationMinutes: number;
  secondsRemaining: number;
} | null {
  try {
    const decodedStr = decodeURIComponent(atob(decodeURIComponent(token)));
    const parsed = JSON.parse(decodedStr);
    const exp = parsed.exp || 0;
    const now = Date.now();
    const expired = now > exp;
    const secondsRemaining = Math.max(0, Math.floor((exp - now) / 1000));

    return {
      candidate: parsed.candidate,
      expired,
      expiresAt: new Date(exp),
      durationMinutes: parsed.duration || 30,
      secondsRemaining,
    };
  } catch (e) {
    return null;
  }
}
