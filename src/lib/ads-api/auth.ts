let cachedToken: { token: string; expiresAt: number } | null = null;

export function resetAdsTokenCache(): void {
  cachedToken = null;
}

export async function refreshAdsAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: process.env.AMAZON_ADS_REFRESH_TOKEN!,
    client_id: process.env.AMAZON_ADS_CLIENT_ID!,
    client_secret: process.env.AMAZON_ADS_CLIENT_SECRET!,
  });

  const response = await fetch("https://api.amazon.co.uk/auth/o2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ads LWA token refresh failed: ${response.status} ${text}`);
  }

  const data = await response.json();

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return data.access_token;
}
