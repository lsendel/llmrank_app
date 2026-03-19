"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@/lib/auth-hooks";
import {
  LayoutDashboard,
  FolderKanban,
  CalendarCheck,
  RotateCcw,
  Zap,
} from "lucide-react";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";
import {
  useDashboardNavCenter,
  useDashboardNavRightExtra,
} from "./dashboard-nav-context";
import {
  getLastProjectContext,
  lastProjectContextHref,
  projectTabLabel,
  type LastProjectContext,
} from "@/lib/workflow-memory";
import { formatRelativeTime } from "@/lib/format";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/projects", label: "Projects", icon: FolderKanban },
];

const portfolioLinks = [
  { href: "/dashboard/plan", label: "7 Days Plan", icon: CalendarCheck },
  { href: "/dashboard/priority-feed", label: "Priority Feed", icon: Zap },
];

function useResumeContext() {
  const [ctx, setCtx] = useState<LastProjectContext | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const refresh = () => setCtx(getLastProjectContext());
    // Small delay so localStorage writes from the project page settle
    const id = setTimeout(refresh, 100);
    window.addEventListener("focus", refresh);
    return () => {
      clearTimeout(id);
      window.removeEventListener("focus", refresh);
    };
  }, [pathname]);

  return ctx;
}

function ResumeProjectLink() {
  const ctx = useResumeContext();

  if (!ctx) return null;

  const href = lastProjectContextHref(ctx);
  const label = ctx.projectName || ctx.domain || "project";
  const tab = projectTabLabel(ctx.tab);
  const timeAgo = formatRelativeTime(ctx.visitedAt);

  return (
    <div className="group relative">
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <RotateCcw className="h-4 w-4" />
        Resume
      </Link>
      <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
        <p className="font-medium">{label}</p>
        <p className="text-muted-foreground">
          {tab} · {timeAgo}
        </p>
      </div>
    </div>
  );
}

export function DashboardNav() {
  const router = useRouter();
  const pathname = usePathname();

  const { data: me } = useApiSWR(
    "account-me",
    useCallback(() => api.account.getMe(), []),
  );

  const { data: projectList } = useApiSWR(
    "projects-guard",
    useCallback(() => api.projects.list({ limit: 1 }), []),
  );

  useEffect(() => {
    if (me && projectList) {
      if (!me.onboardingComplete && projectList.pagination.total === 0) {
        router.push("/onboarding");
      }
    }
  }, [me, projectList, router]);

  function isActiveLink(href: string) {
    if (href === "/dashboard") return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  // Show portfolio links only on main dashboard and their own pages
  const showPortfolioLinks =
    pathname === "/dashboard" ||
    pathname === "/dashboard/plan" ||
    pathname === "/dashboard/priority-feed";

  const { center } = useDashboardNavCenter();
  const { rightExtra } = useDashboardNavRightExtra();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-6">
      <Link
        href="/dashboard"
        className="mr-6 text-lg font-bold tracking-tight text-primary"
      >
        LLM Rank
      </Link>
      <nav className="flex items-center gap-1">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              isActiveLink(link.href)
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <link.icon className="h-4 w-4" />
            {link.label}
          </Link>
        ))}
        {showPortfolioLinks && (
          <>
            <div className="mx-1 h-5 w-px bg-border" />
            {portfolioLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActiveLink(link.href)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            ))}
            <ResumeProjectLink />
          </>
        )}
      </nav>
      {center && (
        <div className="absolute left-1/2 -translate-x-1/2">{center}</div>
      )}
      <div className="ml-auto flex items-center gap-3">
        {rightExtra}
        <UserButton />
      </div>
    </header>
  );
}
