import type { CrawledPage } from "@/lib/api";

export type SortField =
  | "url"
  | "statusCode"
  | "title"
  | "overallScore"
  | "issueCount";

export type SortDirection = "asc" | "desc";

export function getRedirectCount(pages: CrawledPage[]) {
  return pages.filter((page) => page.isCrossDomainRedirect).length;
}

export function filterPages(pages: CrawledPage[], showRedirects: boolean) {
  return showRedirects
    ? pages
    : pages.filter((page) => !page.isCrossDomainRedirect);
}

export function sortPages(
  pages: CrawledPage[],
  sortField: SortField,
  sortDir: SortDirection,
) {
  return [...pages].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (aVal == null || bVal == null) return 0;

    const cmp =
      typeof aVal === "string" && typeof bVal === "string"
        ? aVal.localeCompare(bVal)
        : typeof aVal === "number" && typeof bVal === "number"
          ? aVal - bVal
          : 0;

    return sortDir === "asc" ? cmp : -cmp;
  });
}

export function getNextSortState(
  currentField: SortField,
  currentDir: SortDirection,
  nextField: SortField,
) {
  if (currentField === nextField) {
    return {
      sortField: nextField,
      sortDir: currentDir === "asc" ? "desc" : "asc",
    } satisfies { sortField: SortField; sortDir: SortDirection };
  }

  return {
    sortField: nextField,
    sortDir: "asc",
  } satisfies { sortField: SortField; sortDir: SortDirection };
}

export function getAriaSort(
  field: SortField,
  currentField: SortField,
  currentDir: SortDirection,
): "ascending" | "descending" | "none" {
  if (currentField !== field) return "none";
  return currentDir === "asc" ? "ascending" : "descending";
}
