import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { LayoutDashboard, FolderKanban, Settings } from "lucide-react";

const sidebarLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/projects", label: "Projects", icon: FolderKanban },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

async function checkOnboarding(token: string): Promise<boolean> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
  try {
    const res = await fetch(`${apiBase}/api/account`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 300 },
    });
    if (!res.ok) return false;
    const { data } = await res.json();
    return !!data?.phone;
  } catch {
    return false;
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, getToken } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const token = await getToken();
  if (token) {
    const hasPhone = await checkOnboarding(token);
    if (!hasPhone) {
      redirect("/onboarding");
    }
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
            LLM Boost
          </Link>
        </div>
        <nav className="flex flex-col gap-1 p-4">
          {sidebarLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
        <header className="flex h-16 items-center justify-between border-b border-border px-6">
          <div className="flex items-center gap-4 md:hidden">
            <span className="text-lg font-bold tracking-tight text-primary">
              LLM Boost
            </span>
          </div>
          <div className="ml-auto">
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
