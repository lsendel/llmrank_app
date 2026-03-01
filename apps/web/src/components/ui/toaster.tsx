"use client";

import type { ComponentType } from "react";
import {
  useToastStore,
  dismissToast,
  type ToastVariant,
} from "@/components/ui/use-toast";
import {
  X,
  Bell,
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TOAST_VARIANTS: Record<
  ToastVariant,
  {
    containerClass: string;
    descriptionClass: string;
    icon: ComponentType<{ className?: string }>;
    iconClass: string;
    role: "status" | "alert";
  }
> = {
  default: {
    containerClass: "border-border",
    descriptionClass: "text-muted-foreground",
    icon: Bell,
    iconClass: "text-muted-foreground",
    role: "status",
  },
  destructive: {
    containerClass:
      "border-red-500/50 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100",
    descriptionClass: "text-red-800 dark:text-red-200",
    icon: XCircle,
    iconClass: "text-red-700 dark:text-red-200",
    role: "alert",
  },
  warning: {
    containerClass:
      "border-amber-500/50 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
    descriptionClass: "text-amber-800 dark:text-amber-200",
    icon: AlertTriangle,
    iconClass: "text-amber-700 dark:text-amber-200",
    role: "status",
  },
  success: {
    containerClass:
      "border-green-500/50 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100",
    descriptionClass: "text-green-800 dark:text-green-200",
    icon: CheckCircle2,
    iconClass: "text-green-700 dark:text-green-200",
    role: "status",
  },
  info: {
    containerClass:
      "border-sky-500/50 bg-sky-50 text-sky-900 dark:bg-sky-950 dark:text-sky-100",
    descriptionClass: "text-sky-800 dark:text-sky-200",
    icon: Info,
    iconClass: "text-sky-700 dark:text-sky-200",
    role: "status",
  },
};

export function Toaster() {
  const toasts = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => {
        const variant = toast.variant ?? "default";
        const style = TOAST_VARIANTS[variant];
        const Icon = style.icon;

        return (
          <div
            key={toast.id}
            role={style.role}
            aria-live={style.role === "alert" ? "assertive" : "polite"}
            className={cn(
              "pointer-events-auto w-80 rounded-lg border bg-background p-4 shadow-lg transition-all animate-in slide-in-from-bottom-2 fade-in",
              style.containerClass,
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <Icon
                  className={cn("mt-0.5 h-4 w-4 shrink-0", style.iconClass)}
                />
                <div className="flex-1">
                  {toast.title && (
                    <p className="text-sm font-semibold">{toast.title}</p>
                  )}
                  {toast.description && (
                    <p
                      className={cn(
                        "text-sm",
                        toast.title ? "mt-1" : "",
                        style.descriptionClass,
                      )}
                    >
                      {toast.description}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => dismissToast(toast.id)}
                className="shrink-0 rounded-sm opacity-70 hover:opacity-100"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
