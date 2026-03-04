"use client";

import {
  BarChart3,
  FileText,
  Bug,
  History,
  Compass,
  Trophy,
  Bot,
  User,
  Key,
  Plug,
  Download,
  Play,
  Route,
  Settings,
  Zap,
} from "lucide-react";
import type { ProjectTab } from "@/app/dashboard/projects/[id]/tab-state";

type NavItem = {
  tab: ProjectTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const ALL_NAV_ITEMS: NavItem[] = [
  { tab: "overview", label: "Overview", icon: BarChart3 },
  { tab: "actions", label: "Actions", icon: Zap },
  { tab: "pages", label: "Pages", icon: FileText },
  { tab: "issues", label: "Issues", icon: Bug },
  { tab: "history", label: "History", icon: History },
  { tab: "strategy", label: "Strategy", icon: Compass },
  { tab: "competitors", label: "Competitors", icon: Trophy },
  { tab: "visibility", label: "Visibility", icon: Bot },
  { tab: "personas", label: "Personas", icon: User },
  { tab: "keywords", label: "Keywords", icon: Key },
  { tab: "integrations", label: "Integrations", icon: Plug },
  { tab: "reports", label: "Reports", icon: Download },
  { tab: "automation", label: "Automation", icon: Play },
  { tab: "logs", label: "Logs", icon: Route },
  { tab: "settings", label: "Settings", icon: Settings },
];

interface ProjectMobileNavProps {
  currentTab: ProjectTab;
  onTabChange: (tab: ProjectTab) => void;
}

function isVisibilityTab(tab: ProjectTab): boolean {
  return (
    tab === "visibility" || tab === "ai-visibility" || tab === "ai-analysis"
  );
}

export function ProjectMobileNav({
  currentTab,
  onTabChange,
}: ProjectMobileNavProps) {
  return (
    <nav className="border-b border-border px-4 py-2 md:hidden">
      <div className="flex items-center gap-2 overflow-x-auto">
        {ALL_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.tab === "visibility"
              ? isVisibilityTab(currentTab)
              : currentTab === item.tab;
          return (
            <button
              key={item.tab}
              type="button"
              onClick={() => onTabChange(item.tab)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
