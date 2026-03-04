"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@/lib/auth-hooks";
import { LayoutDashboard, FolderKanban } from "lucide-react";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";
import { ErrorBoundary } from "@/components/error-boundary";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/projects", label: "Projects", icon: FolderKanban },
];

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

  function isActiveLink(href: string) {
    if (href === "/dashboard") return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="flex min-h-screen flex-col">
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
        </nav>
        <div className="ml-auto">
          <UserButton />
        </div>
      </header>
      <main className="dashboard-main flex-1 overflow-y-auto">
        <ErrorBoundary>
          <div className="dashboard-shell">{children}</div>
        </ErrorBoundary>
      </main>
    </div>
  );
}
