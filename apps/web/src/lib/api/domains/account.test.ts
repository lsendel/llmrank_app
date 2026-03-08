import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  putMock: vi.fn(),
}));

vi.mock("../core/client", () => ({
  apiClient: {
    get: getMock,
    put: putMock,
  },
}));

import { createAccountApi } from "./account";

describe("createAccountApi", () => {
  const accountApi = createAccountApi();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads account preferences", async () => {
    const response = { data: { projectsDefaultPreset: "seo_manager" } };
    getMock.mockResolvedValue(response);

    const result = await accountApi.getPreferences();

    expect(getMock).toHaveBeenCalledWith("/api/account/preferences");
    expect(result).toBe(response.data);
  });

  it("loads digest preferences", async () => {
    const response = { data: { digestFrequency: "weekly", digestDay: 2 } };
    getMock.mockResolvedValue(response);

    const result = await accountApi.getDigestPreferences();

    expect(getMock).toHaveBeenCalledWith("/api/account/digest");
    expect(result).toBe(response.data);
  });

  it("updates digest preferences", async () => {
    const payload = { digestFrequency: "daily", digestDay: 1 };
    putMock.mockResolvedValue({ data: payload });

    const result = await accountApi.updateDigestPreferences(payload);

    expect(putMock).toHaveBeenCalledWith("/api/account/digest", payload);
    expect(result).toEqual(payload);
  });
});
