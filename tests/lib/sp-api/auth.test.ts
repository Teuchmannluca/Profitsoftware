import { describe, it, expect, vi, beforeEach } from "vitest";
import { refreshAccessToken, resetTokenCache } from "@/lib/sp-api/auth";

describe("refreshAccessToken", () => {
  beforeEach(() => {
    resetTokenCache();
    vi.stubEnv("SP_API_CLIENT_ID", "test-client-id");
    vi.stubEnv("SP_API_CLIENT_SECRET", "test-client-secret");
    vi.stubEnv("SP_API_REFRESH_TOKEN", "test-refresh-token");
  });

  it("returns access token on successful refresh", async () => {
    const mockResponse = {
      access_token: "Atza|new-access-token",
      refresh_token: "Atzr|new-refresh-token",
      token_type: "bearer",
      expires_in: 3600,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const token = await refreshAccessToken();
    expect(token).toBe("Atza|new-access-token");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.amazon.com/auth/o2/token",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      })
    );
  });

  it("throws on failed refresh", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });

    await expect(refreshAccessToken()).rejects.toThrow(
      "LWA token refresh failed: 401"
    );
  });
});
