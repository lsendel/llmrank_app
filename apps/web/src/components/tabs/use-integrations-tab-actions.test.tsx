import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type ProjectIntegration } from "@/lib/api";
import { useIntegrationsTabActions } from "./use-integrations-tab-actions";

const { toastMock, withAuthMock, trackMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  withAuthMock: vi.fn((callback: () => unknown) => callback()),
  trackMock: vi.fn(),
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/use-api", () => ({
  useApi: () => ({ withAuth: withAuthMock }),
}));

vi.mock("@/lib/telemetry", () => ({
  track: trackMock,
}));

describe("useIntegrationsTabActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.integrations.startGoogleOAuth = vi.fn();
    api.integrations.startMetaOAuth = vi.fn();
    api.integrations.connect = vi.fn();
    api.integrations.sync = vi.fn();
    api.integrations.update = vi.fn();
    api.integrations.disconnect = vi.fn();
    api.integrations.test = vi.fn();
    api.actionItems.bulkCreate = vi.fn();
  });

  it("auto-opens the connect modal for clarity", async () => {
    const { result } = renderHook(() =>
      useIntegrationsTabActions({
        projectId: "proj-1",
        currentPlan: "agency",
        connectProvider: "clarity",
        integrations: [],
        signalTaskPlan: { reasons: [], items: [] },
        refreshIntegrations: vi.fn(async () => undefined),
        refreshInsights: vi.fn(async () => undefined),
      }),
    );

    await waitFor(() => {
      expect(result.current.connectModal).toEqual({
        provider: "clarity",
        label: "Microsoft Clarity",
      });
    });
  });

  it("surfaces a plan error when auto-connect is gated", async () => {
    const { result } = renderHook(() =>
      useIntegrationsTabActions({
        projectId: "proj-1",
        currentPlan: "starter",
        connectProvider: "gsc",
        integrations: [],
        signalTaskPlan: { reasons: [], items: [] },
        refreshIntegrations: vi.fn(async () => undefined),
        refreshInsights: vi.fn(async () => undefined),
      }),
    );

    await waitFor(() => {
      expect(result.current.error).toBe(
        "Google Search Console requires Pro plan.",
      );
    });
  });

  it("connects API-key integrations, resets the modal, and refreshes data", async () => {
    const refreshIntegrations = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useIntegrationsTabActions({
        projectId: "proj-1",
        currentPlan: "agency",
        integrations: [],
        signalTaskPlan: { reasons: [], items: [] },
        refreshIntegrations,
        refreshInsights: vi.fn(async () => undefined),
      }),
    );

    act(() => {
      result.current.openConnectModal("clarity", "Microsoft Clarity");
      result.current.setApiKeyInput("secret-key");
      result.current.setClarityProjectId("clarity-123");
    });

    await act(async () => {
      await result.current.handleConnect();
    });

    expect(api.integrations.connect).toHaveBeenCalledWith("proj-1", {
      provider: "clarity",
      apiKey: "secret-key",
      clarityProjectId: "clarity-123",
    });
    expect(refreshIntegrations).toHaveBeenCalledTimes(1);
    expect(result.current.connectModal).toBeNull();
    expect(result.current.apiKeyInput).toBe("");
    expect(result.current.clarityProjectId).toBe("");
  });

  it("toasts sync results and refreshes integrations plus insights", async () => {
    const refreshIntegrations = vi.fn(async () => undefined);
    const refreshInsights = vi.fn(async () => undefined);
    api.integrations.sync = vi.fn(async () => ({
      enrichmentCount: 12,
      providers: [
        { provider: "gsc", ok: true },
        { provider: "ga4", ok: false, error: "Quota exceeded" },
      ],
    }));

    const { result } = renderHook(() =>
      useIntegrationsTabActions({
        projectId: "proj-1",
        currentPlan: "agency",
        integrations: [],
        signalTaskPlan: { reasons: [], items: [] },
        refreshIntegrations,
        refreshInsights,
      }),
    );

    await act(async () => {
      await result.current.handleSync();
    });

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Sync partially complete",
        description: "12 enrichment rows stored. Errors: ga4: Quota exceeded",
      }),
    );
    expect(refreshIntegrations).toHaveBeenCalledTimes(1);
    expect(refreshInsights).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith("integration.synced", {
      projectId: "proj-1",
    });
  });

  it("stores a failed test result when the integration test call errors", async () => {
    api.integrations.test = vi.fn(async () => {
      throw new Error("Boom");
    });

    const { result } = renderHook(() =>
      useIntegrationsTabActions({
        projectId: "proj-1",
        currentPlan: "agency",
        integrations: [
          {
            id: "gsc-1",
            provider: "gsc",
            hasCredentials: true,
            enabled: true,
          },
        ] as ProjectIntegration[],
        signalTaskPlan: { reasons: [], items: [] },
        refreshIntegrations: vi.fn(async () => undefined),
        refreshInsights: vi.fn(async () => undefined),
      }),
    );

    await act(async () => {
      await result.current.handleTest("gsc-1");
    });

    expect(result.current.testResult).toEqual({
      id: "gsc-1",
      ok: false,
      message: "Boom",
    });
    expect(trackMock).toHaveBeenCalledWith("integration.tested", {
      integrationType: "gsc",
    });
  });
});
