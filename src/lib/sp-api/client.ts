import { refreshAccessToken } from "./auth";

const BASE_URL = "https://sellingpartnerapi-eu.amazon.com";

export async function spApiFetch(path: string): Promise<Response> {
  const token = await refreshAccessToken();

  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "x-amz-access-token": token,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const requestId = response.headers.get("x-amzn-RequestId") ?? "unknown";
    throw new Error(
      `SP-API error ${response.status} [${requestId}]: ${await response.text()}`
    );
  }

  return response;
}
