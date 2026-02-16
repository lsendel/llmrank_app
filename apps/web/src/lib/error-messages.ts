export const ERROR_MESSAGES: Record<string, string> = {
  CRAWLER_UNAVAILABLE:
    "The crawler service is temporarily unavailable. Please try again in a few minutes.",
  CRAWLER_TIMEOUT:
    "The crawler service took too long to respond. Please try again.",
  CRAWL_IN_PROGRESS:
    "A crawl is already running for this project. Please wait for it to complete.",
  PLAN_LIMIT_REACHED:
    "You've reached the limit for your current plan. Upgrade to continue.",
  CRAWL_LIMIT_REACHED: "You've used all your crawl credits this month.",
  INVALID_DOMAIN: "Please enter a valid domain (e.g. example.com).",
};

export function getErrorMessage(code: string, fallback: string): string {
  return ERROR_MESSAGES[code] ?? fallback;
}
