import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AiTrafficTab } from "./ai-traffic-tab";

vi.mock("@/lib/api", () => ({
  api: {
    analytics: {
      getSummary: vi.fn(),
    },
  },
}));

import { api } from "@/lib/api";

describe("AiTrafficTab", () => {
  it("renders analytics summary data from the API response shape", async () => {
    vi.mocked(api.analytics.getSummary).mockResolvedValue({
      totalPageviews: 1250,
      aiTraffic: {
        referral: 120,
        bot: 45,
        total: 165,
      },
      retentionDays: 30,
      trend: {
        pageviewsTrend: 12.5,
        aiTrafficTrend: 20,
      },
      byProvider: {
        chatgpt: 80,
        perplexity: 40,
      },
      topPages: [
        {
          path: "/pricing",
          aiVisits: 22,
          totalVisits: 100,
        },
      ],
    });

    render(<AiTrafficTab projectId="proj-1" snippetEnabled />);

    await waitFor(() => {
      expect(screen.getByText("1,250")).toBeInTheDocument();
    });

    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("AI Provider Breakdown")).toBeInTheDocument();
    expect(screen.getByText("chatgpt")).toBeInTheDocument();
    expect(screen.getByText("/pricing")).toBeInTheDocument();
  });
});
