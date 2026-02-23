/** @jsxImportSource hono/jsx */
import type { Context } from "hono";

/** Return an HTMX redirect via HX-Redirect header */
export function htmxRedirect(c: Context, url: string) {
  return c.body(null, 204, { "HX-Redirect": url });
}

/** Return a toast notification via OOB swap */
export function htmxToast(
  message: string,
  type: "success" | "error" | "info" = "success",
) {
  const colors = { success: "green", error: "red", info: "blue" };
  const color = colors[type];
  const icon =
    type === "success" ? (
      <svg
        class="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2.5"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M5 13l4 4L19 7"
        />
      </svg>
    ) : type === "error" ? (
      <svg
        class="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2.5"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    ) : (
      <svg
        class="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2.5"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 110 20 10 10 0 010-20z"
        />
      </svg>
    );
  return (
    <div
      id="toast"
      hx-swap-oob="true"
      class={`fixed right-4 top-4 z-50 flex items-center gap-2.5 rounded-lg border bg-${color}-50 px-4 py-3 text-sm text-${color}-700 shadow-lg`}
      x-data="{ show: true }"
      x-init="setTimeout(() => show = false, 3000)"
      x-show="show"
      x-transition:enter="transition ease-out duration-200"
      x-transition:enter-start="opacity-0 translate-x-4"
      x-transition:enter-end="opacity-100 translate-x-0"
      x-transition:leave="transition ease-in duration-150"
      x-transition:leave-start="opacity-100 translate-x-0"
      x-transition:leave-end="opacity-0 translate-x-4"
    >
      <span
        class={`flex h-5 w-5 items-center justify-center rounded-full bg-${color}-500 text-white`}
      >
        {icon}
      </span>
      {message}
    </div>
  );
}

/** Render an empty element to clear a target */
export function htmxClear(id: string) {
  return <div id={id} hx-swap-oob="true"></div>;
}

/** Return inline "Saved" confirmation */
export function htmxSaved() {
  return <span class="text-sm text-green-600">Saved</span>;
}

// ─── Skeleton & spinner components ────────────────────

/** Pulsing gray text bars for loading states */
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div class="animate-pulse space-y-3 py-4">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          class={`h-4 rounded bg-gray-200 dark:bg-gray-700 ${i === lines - 1 ? "w-3/4" : "w-full"}`}
        ></div>
      ))}
    </div>
  );
}

/** Card outline with title/subtitle/bar placeholders */
export function SkeletonCard() {
  return (
    <div class="animate-pulse rounded-lg border bg-white p-5 dark:bg-gray-900">
      <div class="h-4 w-1/3 rounded bg-gray-200 dark:bg-gray-700"></div>
      <div class="mt-2 h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-700"></div>
      <div class="mt-4 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700"></div>
      <div class="mt-3 flex gap-4">
        <div class="h-3 w-16 rounded bg-gray-200 dark:bg-gray-700"></div>
        <div class="h-3 w-20 rounded bg-gray-200 dark:bg-gray-700"></div>
      </div>
    </div>
  );
}

/** Table header + N row placeholders */
export function SkeletonTable({ rows = 4 }: { rows?: number }) {
  return (
    <div class="animate-pulse overflow-hidden rounded-lg border bg-white dark:bg-gray-900">
      <div class="flex gap-4 border-b px-4 py-3">
        <div class="h-3 w-1/4 rounded bg-gray-200 dark:bg-gray-700"></div>
        <div class="h-3 w-1/6 rounded bg-gray-200 dark:bg-gray-700"></div>
        <div class="h-3 w-1/4 rounded bg-gray-200 dark:bg-gray-700"></div>
        <div class="h-3 w-1/6 rounded bg-gray-200 dark:bg-gray-700"></div>
      </div>
      {Array.from({ length: rows }).map(() => (
        <div class="flex gap-4 border-b px-4 py-3 last:border-0">
          <div class="h-3 w-1/4 rounded bg-gray-100 dark:bg-gray-800"></div>
          <div class="h-3 w-1/6 rounded bg-gray-100 dark:bg-gray-800"></div>
          <div class="h-3 w-1/4 rounded bg-gray-100 dark:bg-gray-800"></div>
          <div class="h-3 w-1/6 rounded bg-gray-100 dark:bg-gray-800"></div>
        </div>
      ))}
    </div>
  );
}

/** Card with title bar + large gray rectangle for chart area */
export function SkeletonChart() {
  return (
    <div class="animate-pulse rounded-lg border bg-white p-6 dark:bg-gray-900">
      <div class="mb-4 h-4 w-1/4 rounded bg-gray-200 dark:bg-gray-700"></div>
      <div class="h-48 w-full rounded bg-gray-200 dark:bg-gray-700"></div>
    </div>
  );
}

/** Border-spinner using animate-spin */
export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-8 w-8" };
  return (
    <span
      class={`inline-block animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 ${sizeClasses[size]}`}
      role="status"
    ></span>
  );
}

/** Breadcrumb navigation with / separators */
export function Breadcrumb({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav class="mb-4 flex items-center gap-1.5 text-sm text-gray-500">
      {items.map((item, i) => (
        <>
          {i > 0 && <span class="text-gray-300">/</span>}
          {item.href ? (
            <a href={item.href} class="hover:text-gray-700 hover:underline">
              {item.label}
            </a>
          ) : (
            <span class="font-medium text-gray-900 dark:text-gray-100">
              {item.label}
            </span>
          )}
        </>
      ))}
    </nav>
  );
}
