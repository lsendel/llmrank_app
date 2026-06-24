"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { getIntegrationResourceLinks } from "@/lib/integration-resource-links";

export function IntegrationResourceLinks({
  resourceKey,
  className,
  linkClassName,
}: {
  resourceKey: string | null | undefined;
  className?: string;
  linkClassName?: string;
}) {
  const links = getIntegrationResourceLinks(resourceKey);

  if (links.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-x-3 gap-y-2", className)}>
      {links.map((link) => {
        const content = (
          <>
            {link.label}
            {link.external === false ? null : (
              <ExternalLink className="h-3 w-3" />
            )}
          </>
        );

        const classes = cn(
          "inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2 hover:text-primary/80",
          linkClassName,
        );

        return link.external === false ? (
          <Link key={link.label} href={link.href} className={classes}>
            {content}
          </Link>
        ) : (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className={classes}
          >
            {content}
          </a>
        );
      })}
    </div>
  );
}
