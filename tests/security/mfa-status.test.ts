/**
 * Tests for MFA API status route
 *
 * Tests GET /api/auth/mfa/status endpoint behavior
 * including authenticated/unauthenticated flows and MFA factor listing.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/auth/mfa/status/route";

const createServerClientMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => createServerClientMock(),
}));

describe("MFA Status API", () => {
  beforeEach(() => {
    createServerClientMock.mockReset();
  });

  it("returns 401 when user is not authenticated", async () => {
    createServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: null }, error: null }),
      },
    });

    const request = new Request("http://localhost/api/auth/mfa/status");
    const response = await GET(request as never);
    expect(response.status).toBe(401);
  });

  it("returns MFA status for authenticated user with no factors", async () => {
    createServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
            data: { currentLevel: "aal1", nextLevel: "aal1" },
            error: null,
          }),
          listFactors: vi.fn().mockResolvedValue({
            data: { all: [], totp: [], phone: [] },
            error: null,
          }),
        },
      },
    });

    const request = new Request("http://localhost/api/auth/mfa/status");
    const response = await GET(request as never);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    expect(json.data.enabled).toBe(false);
    expect(json.data.totpEnabled).toBe(false);
    expect(json.data.phoneEnabled).toBe(false);
    expect(json.data.factors).toEqual([]);
  });

  it("returns enabled MFA status when TOTP factor is verified", async () => {
    createServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
            data: { currentLevel: "aal2", nextLevel: "aal2" },
            error: null,
          }),
          listFactors: vi.fn().mockResolvedValue({
            data: {
              all: [
                {
                  id: "factor-1",
                  factor_type: "totp",
                  friendly_name: "My Auth App",
                  status: "verified",
                  created_at: "2025-01-01T00:00:00Z",
                  updated_at: "2025-01-01T00:00:00Z",
                },
              ],
              totp: [],
              phone: [],
            },
            error: null,
          }),
        },
      },
    });

    const request = new Request("http://localhost/api/auth/mfa/status");
    const response = await GET(request as never);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    expect(json.data.enabled).toBe(true);
    expect(json.data.totpEnabled).toBe(true);
    expect(json.data.factors).toHaveLength(1);
    expect(json.data.factors[0].type).toBe("totp");
  });

  it("returns 500 when listFactors fails", async () => {
    createServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
            data: { currentLevel: "aal1", nextLevel: "aal1" },
            error: null,
          }),
          listFactors: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Internal error" },
          }),
        },
      },
    });

    const request = new Request("http://localhost/api/auth/mfa/status");
    const response = await GET(request as never);
    expect(response.status).toBe(500);
  });
});
