import { render, screen, waitFor } from "@testing-library/react";
import GoogleOAuthCallbackPage from "./page";
import { vi } from "vitest";

const { mockReplace, mockWithAuth, mockOauthCallback } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockWithAuth: vi.fn(async (fn: () => Promise<void>) => fn()),
  mockOauthCallback: vi.fn(),
}));

let params: Record<string, string | null> = {};

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => params[key] ?? null,
  }),
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

vi.mock("@/lib/use-api", () => ({
  useApi: () => ({ withAuth: mockWithAuth }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    integrations: {
      oauthCallback: mockOauthCallback,
    },
  },
}));

describe("Google OAuth callback page", () => {
  beforeEach(() => {
    params = {};
    mockReplace.mockReset();
    mockWithAuth.mockClear();
    mockOauthCallback.mockReset();
  });

  it("shows a validation error when code or state is missing", () => {
    render(<GoogleOAuthCallbackPage />);

    expect(screen.getByText("Connection Failed")).toBeInTheDocument();
    expect(
      screen.getByText("Missing authorization code or state parameter."),
    ).toBeInTheDocument();
  });

  it("shows a validation error when state cannot be decoded", () => {
    params = {
      code: "code-123",
      state: "not-valid-base64",
    };

    render(<GoogleOAuthCallbackPage />);

    expect(screen.getByText("Connection Failed")).toBeInTheDocument();
    expect(screen.getByText("Invalid state parameter.")).toBeInTheDocument();
  });

  it("exchanges tokens and redirects to integrations tab with connected state", async () => {
    const state = btoa(
      JSON.stringify({ projectId: "proj-1", provider: "gsc" }),
    );
    params = {
      code: "code-123",
      state,
    };
    mockOauthCallback.mockResolvedValue({
      id: "int-1",
      projectId: "proj-1",
      provider: "gsc",
      enabled: true,
      hasCredentials: true,
    });

    render(<GoogleOAuthCallbackPage />);

    await waitFor(() => {
      expect(mockOauthCallback).toHaveBeenCalledWith({
        code: "code-123",
        state,
        redirectUri: `${window.location.origin}/integrations/callback/google`,
      });
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        "/dashboard/projects/proj-1?tab=integrations&connected=gsc",
      );
    });
  });
});
