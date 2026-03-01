"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { track } from "@/lib/telemetry";

const REDIRECT_TARGET_KEY = "auth.redirect_target";
const REDIRECT_SOURCE_KEY = "auth.redirect_source";
const REDIRECT_METHOD_KEY = "auth.redirect_method";

function normalizePath(value: string): string {
  if (!value) return "/";
  return value.startsWith("/") ? value : `/${value}`;
}

export function setPendingAuthRedirect(
  target: string,
  source: "sign-in" | "sign-up",
  method: "email" | "google",
): void {
  if (typeof window === "undefined") return;

  window.sessionStorage.setItem(REDIRECT_TARGET_KEY, normalizePath(target));
  window.sessionStorage.setItem(REDIRECT_SOURCE_KEY, source);
  window.sessionStorage.setItem(REDIRECT_METHOD_KEY, method);
}

export function clearPendingAuthRedirect(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(REDIRECT_TARGET_KEY);
  window.sessionStorage.removeItem(REDIRECT_SOURCE_KEY);
  window.sessionStorage.removeItem(REDIRECT_METHOD_KEY);
}

export function AuthRedirectTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const target = window.sessionStorage.getItem(REDIRECT_TARGET_KEY);
    if (!target) return;

    const source =
      window.sessionStorage.getItem(REDIRECT_SOURCE_KEY) ?? "unknown";
    const method =
      window.sessionStorage.getItem(REDIRECT_METHOD_KEY) ?? "unknown";
    const qs = searchParams.toString();
    const currentPath = `${pathname}${qs ? `?${qs}` : ""}`;
    const normalizedTarget = normalizePath(target);

    if (currentPath !== normalizedTarget && pathname !== normalizedTarget) {
      return;
    }

    track("auth.redirect_destination_reached", {
      redirect_target: normalizedTarget,
      redirect_source: source,
      auth_method: method,
      current_path: currentPath,
    });

    clearPendingAuthRedirect();
  }, [pathname, searchParams]);

  return null;
}
