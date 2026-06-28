import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CrawlProgress } from "./crawl-progress";

describe("CrawlProgress", () => {
  it("shows sampled progress separately from discovered URLs", () => {
    render(
      <CrawlProgress
        status="complete"
        pagesFound={31574}
        pagesCrawled={2000}
        pagesScored={2000}
        pagesTarget={2000}
      />,
    );

    expect(screen.getByText("2000 / 2000 pages")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(
      screen.getByText(/31574 URLs discovered; this crawl is measuring/i),
    ).toBeInTheDocument();
  });
});
