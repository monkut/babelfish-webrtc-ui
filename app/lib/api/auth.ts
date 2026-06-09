// JWT acquisition for the WebRTC signaling endpoints.
//
// The backend's `POST /offer` is JWT-gated (#27 Phase B): exchange client
// credentials at `POST /token` for a bearer token, then send it on the offer.
// Credentials are build-time env (`VITE_CLIENT_ID` / `VITE_CLIENT_SECRET`) —
// acceptable for this internal LAN tool, where the operator already trusts the
// host serving the SPA. The token is cached in memory and refreshed shortly
// before expiry.

import { apiUrl } from "./config";

const CLIENT_ID = import.meta.env.VITE_CLIENT_ID || "";
const CLIENT_SECRET = import.meta.env.VITE_CLIENT_SECRET || "";

// Refresh this many ms before the token actually expires, so an in-flight
// offer never races a just-expired token.
const EXPIRY_SKEW_MS = 30_000;

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

let cached: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt - EXPIRY_SKEW_MS) {
    return cached.token;
  }
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Missing VITE_CLIENT_ID / VITE_CLIENT_SECRET — cannot authenticate.");
  }

  const res = await fetch(apiUrl("/token"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  if (!res.ok) throw new Error(`Token request failed: ${res.status}`);

  const data: TokenResponse = await res.json();
  cached = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cached.token;
}
