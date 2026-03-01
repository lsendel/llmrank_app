"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type StateVariant = "loading" | "empty" | "error";

interface RetryAction {
  onClick: () => void | Promise<void>;
  label?: string;
  disabled?: boolean;
}

interface StateMessageProps {
  variant: StateVariant;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  retry?: RetryAction;
  icon?: ReactNode;
  className?: string;
  compact?: boolean;
}

interface StateCardProps extends StateMessageProps {
  cardTitle?: ReactNode;
  cardClassName?: string;
  contentClassName?: string;
}

function defaultIcon(variant: StateVariant): ReactNode {
  if (variant === "loading") {
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  }
  if (variant === "error") {
    return <AlertTriangle className="h-5 w-5 text-destructive" />;
  }
  return <Inbox className="h-5 w-5 text-muted-foreground" />;
}

function defaultTitle(variant: StateVariant): string {
  if (variant === "loading") return "Loading";
  if (variant === "error") return "Could not load data";
  return "Nothing here yet";
}

export function StateMessage({
  variant,
  title,
  description,
  action,
  retry,
  icon,
  className,
  compact = false,
}: StateMessageProps) {
  const resolvedAction =
    action ??
    (retry ? (
      <Button
        type="button"
        size={compact ? "sm" : "default"}
        variant="outline"
        onClick={retry.onClick}
        disabled={retry.disabled}
      >
        {retry.label ?? "Retry"}
      </Button>
    ) : null);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 py-4" : "gap-3 py-8",
        className,
      )}
    >
      <div>{icon ?? defaultIcon(variant)}</div>
      <div className="space-y-1">
        <p
          className={cn(
            "font-medium",
            variant === "error" ? "text-destructive" : "text-foreground",
            compact ? "text-sm" : "text-base",
          )}
        >
          {title ?? defaultTitle(variant)}
        </p>
        {description && (
          <p
            className={cn(
              "text-muted-foreground",
              compact ? "text-xs" : "text-sm",
            )}
          >
            {description}
          </p>
        )}
      </div>
      {resolvedAction}
    </div>
  );
}

export function StateCard({
  variant,
  title,
  description,
  action,
  retry,
  icon,
  cardTitle,
  className,
  cardClassName,
  contentClassName,
  compact,
}: StateCardProps) {
  return (
    <Card className={cardClassName}>
      {cardTitle && (
        <CardHeader>
          <CardTitle className="text-base">{cardTitle}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={contentClassName}>
        <StateMessage
          variant={variant}
          title={title}
          description={description}
          action={action}
          retry={retry}
          icon={icon}
          className={className}
          compact={compact}
        />
      </CardContent>
    </Card>
  );
}
