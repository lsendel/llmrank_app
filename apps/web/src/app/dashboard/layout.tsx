"use client";

import { useCallback, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@/lib/auth-hooks";
import {
  LayoutDashboard,
  FolderKanban,
  Settings,
  ShieldCheck,
  Receipt,
} from "lucide-react";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";
import { ErrorBoundary } from "@/components/error-boundary";

const baseSidebarLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/projects", label: "Projects", icon: FolderKanban },
  { href: "/dashboard/billing", label: "Billing", icon: Receipt },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const adminLink = {
  href: "/dashboard/admin",
  label: "Admin",
  icon: ShieldCheck,
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // Auth is enforced by middleware.ts — if we reach here, user has a session cookie
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

  const sidebarLinks = useMemo(
    () => (me?.isAdmin ? [...baseSidebarLinks, adminLink] : baseSidebarLinks),
    [me?.isAdmin],
  );

  function isActiveLink(href: string) {
    if (href === "/dashboard") return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-sidebar-border bg-sidebar-background md:block">
        <div className="flex h-16 items-center border-b border-sidebar-border px-6">
          <Link
            href="/dashboard"
            className="text-lg font-bold tracking-tight text-primary"
          >
            LLM Rank
          </Link>
        </div>
        <nav className="flex flex-col gap-1 p-4">
          {sidebarLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActiveLink(link.href)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Top header */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-6">
          <div className="flex items-center gap-4 md:hidden">
            <span className="text-lg font-bold tracking-tight text-primary">
              LLM Rank
            </span>
          </div>
          <div className="ml-auto">
            <UserButton />
          </div>
        </header>
        <nav className="border-b border-border px-4 py-2 md:hidden">
          <div className="flex items-center gap-2 overflow-x-auto">
            {sidebarLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  isActiveLink(link.href)
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <link.icon className="h-3.5 w-3.5" />
                {link.label}
              </Link>
            ))}
          </div>
        </nav>

        {/* Page content */}
        <main className="dashboard-main flex-1 overflow-y-auto">
          <ErrorBoundary>
            <div className="dashboard-shell">{children}</div>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
