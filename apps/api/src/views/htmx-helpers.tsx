/** @jsxImportSource hono/jsx */
import type { Context } from "hono";

/** Return an HTMX redirect via HX-Redirect header */
export function htmxRedirect(c: Context, url: string) {
  return c.body(null, 204, { "HX-Redirect": url });
}

/** Return a toast notification via OOB swap */
export function htmxToast(
  message: string,
  type: "success" | "error" = "success",
) {
  const color = type === "success" ? "green" : "red";
  return (
    <div
      id="toast"
      hx-swap-oob="true"
      class={`fixed right-4 top-4 z-50 rounded-lg border bg-${color}-50 px-4 py-3 text-sm text-${color}-700 shadow-lg`}
      x-data="{ show: true }"
      x-init="setTimeout(() => show = false, 3000)"
      x-show="show"
      x-transition
    >
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
