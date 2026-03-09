import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  PagesTabCard,
  PagesTabEmptyState,
  PagesTabRedirectToggle,
  PagesTabTable,
} from "./pages-tab-sections";

const page = {
  id: "page-1",
  crawlId: "crawl-1",
  url: "https://example.com/a",
  statusCode: 301,
  title: "Alpha",
  metaDescription: null,
  wordCount: 100,
  overallScore: 91,
  technicalScore: 90,
  contentScore: 91,
  aiReadinessScore: 92,
  performanceScore: 93,
  letterGrade: "A",
  issueCount: 1,
  isCrossDomainRedirect: true,
  redirectUrl: "https://other.example.com/a",
};

describe("pages-tab sections", () => {
  it("renders the empty state", () => {
    render(<PagesTabEmptyState />);
    expect(screen.getByText(/No pages crawled yet/i)).toBeInTheDocument();
  });

  it("forwards redirect toggle changes", () => {
    const onShowRedirectsChange = vi.fn();

    render(
      <PagesTabRedirectToggle
        redirectCount={2}
        showRedirects={false}
        onShowRedirectsChange={onShowRedirectsChange}
      />,
    );

    fireEvent.click(screen.getByLabelText(/Show redirects/i));
    expect(onShowRedirectsChange).toHaveBeenCalledWith(true);
  });

  it("renders sortable rows and expanded row details", () => {
    const onSort = vi.fn();
    const onToggleExpandedRow = vi.fn();

    render(
      <PagesTabCard>
        <PagesTabTable
          pages={[page]}
          projectId="proj-1"
          sortField="url"
          sortDir="asc"
          expandedRow="page-1"
          onSort={onSort}
          onToggleExpandedRow={onToggleExpandedRow}
        />
      </PagesTabCard>,
    );

    fireEvent.click(screen.getByRole("columnheader", { name: /Status/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /https:\/\/example.com\/a/i }),
    );

    expect(onSort).toHaveBeenCalledWith("statusCode");
    expect(onToggleExpandedRow).toHaveBeenCalledWith("page-1");
    expect(screen.getByText(/Redirects to:/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View Details/i })).toHaveAttribute(
      "href",
      "/dashboard/projects/proj-1/pages/page-1",
    );
  });
});
