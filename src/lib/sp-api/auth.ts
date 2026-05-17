import type { LwaTokenResponse } from "./types";

let cachedToken: { token: string; expiresAt: number } | null = null;

/** Reset the in-memory token cache. Useful for testing. */
export function resetTokenCache(): void {
  cachedToken = null;
}

export async function refreshAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: process.env.SP_API_REFRESH_TOKEN!,
    client_id: process.env.SP_API_CLIENT_ID!,
    client_secret: process.env.SP_API_CLIENT_SECRET!,
  });

  const response = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`LWA token refresh failed: ${response.status}`);
  }

  const data: LwaTokenResponse = await response.json();

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return data.access_token;
}
