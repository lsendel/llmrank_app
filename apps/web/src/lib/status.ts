export function getStatusBadgeVariant(
  status: string,
): "success" | "destructive" | "warning" | "secondary" {
  if (status === "complete") return "success";
  if (status === "failed") return "destructive";
  if (status === "crawling" || status === "scoring") return "warning";
  return "secondary";
}
