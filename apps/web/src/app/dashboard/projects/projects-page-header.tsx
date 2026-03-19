"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ProjectsPageHeader() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your portfolio with shareable filters and bulk actions.
        </p>
      </div>
      <Button asChild>
        <Link href="/dashboard/projects/new">
          <Plus className="h-4 w-4" />
          New Project
        </Link>
      </Button>
    </div>
  );
}
