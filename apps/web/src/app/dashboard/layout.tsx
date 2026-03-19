import { DashboardNav } from "./dashboard-nav";
import { DashboardNavSlotsProvider } from "./dashboard-nav-context";
import { ErrorBoundary } from "@/components/error-boundary";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardNavSlotsProvider>
      <div className="flex min-h-screen flex-col">
        <DashboardNav />
        <main className="dashboard-main flex-1 overflow-y-auto">
          <ErrorBoundary>
            <div className="dashboard-shell">{children}</div>
          </ErrorBoundary>
        </main>
      </div>
    </DashboardNavSlotsProvider>
  );
}
