"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const PLATFORMS = [
  {
    id: "html",
    label: "HTML",
    instructions:
      "Paste the snippet inside the <head> tag of your index.html file, before the closing </head>.",
  },
  {
    id: "wordpress",
    label: "WordPress",
    instructions:
      "Go to Appearance → Theme File Editor → header.php. Paste the snippet before </head>. Or use the 'Insert Headers and Footers' plugin to add it without editing theme files.",
  },
  {
    id: "shopify",
    label: "Shopify",
    instructions:
      "Go to Online Store → Themes → Edit Code → theme.liquid. Paste the snippet inside the <head> section before </head>.",
  },
  {
    id: "nextjs",
    label: "Next.js",
    instructions:
      "Add the snippet to app/layout.tsx using next/script with strategy='afterInteractive', or add it to your custom _document.tsx <Head>.",
  },
  {
    id: "cloudflare",
    label: "Cloudflare",
    instructions:
      "Add the snippet to your index.html <head>. For automatic injection without code changes, see the Cloudflare Zaraz option below.",
  },
  {
    id: "vercel",
    label: "Vercel",
    instructions:
      "For Next.js, add via app/layout.tsx. For static sites, add to index.html <head>.",
  },
] as const;

export function SnippetInstallGuides() {
  const [selected, setSelected] = useState("html");
  const platform = PLATFORMS.find((p) => p.id === selected)!;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Platform guide
      </p>
      <div className="flex flex-wrap gap-1">
        {PLATFORMS.map((p) => (
          <Button
            key={p.id}
            variant={selected === p.id ? "default" : "outline"}
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={() => setSelected(p.id)}
          >
            {p.label}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{platform.instructions}</p>
    </div>
  );
}
