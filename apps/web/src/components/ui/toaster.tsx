"use client";

import { useToastStore, dismissToast } from "@/components/ui/use-toast";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Toaster() {
  const toasts = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto w-80 rounded-lg border bg-background p-4 shadow-lg transition-all animate-in slide-in-from-bottom-2 fade-in",
            toast.variant === "destructive"
              ? "border-red-500/50 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100"
              : "border-border",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              {toast.title && (
                <p className="text-sm font-semibold">{toast.title}</p>
              )}
              {toast.description && (
                <p
                  className={cn(
                    "text-sm",
                    toast.title ? "mt-1 text-muted-foreground" : "",
                    toast.variant === "destructive"
                      ? "text-red-800 dark:text-red-200"
                      : "",
                  )}
                >
                  {toast.description}
                </p>
              )}
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="shrink-0 rounded-sm opacity-70 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
