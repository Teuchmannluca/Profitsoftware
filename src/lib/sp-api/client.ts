import { refreshAccessToken } from "./auth";

const BASE_URL = "https://sellingpartnerapi-eu.amazon.com";
const MAX_RETRIES = 3;

export async function spApiFetch(path: string): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const token = await refreshAccessToken();

    const response = await fetch(`${BASE_URL}${path}`, {
      headers: {
        "x-amz-access-token": token,
        "Content-Type": "application/json",
      },
    });

    if (response.status === 429) {
      if (attempt < MAX_RETRIES) {
        const waitSec = attempt === 0 ? 30 : 60;
        console.log(`[sp-api] 429 rate limited on ${path.split("?")[0]} — waiting ${waitSec}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise((r) => setTimeout(r, waitSec * 1000));
        continue;
      }
    }

    if (!response.ok) {
      const requestId = response.headers.get("x-amzn-RequestId") ?? "unknown";
      throw new Error(
        `SP-API error ${response.status} [${requestId}]: ${await response.text()}`
      );
    }

    return response;
  }

  throw new Error("SP-API: max retries exceeded");
}
