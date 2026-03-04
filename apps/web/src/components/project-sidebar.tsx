"use client";

import {
  BarChart3,
  FileText,
  Bug,
  History,
  Compass,
  Trophy,
  Bot,
  Radar,
  Eye,
  User,
  Key,
  Plug,
  Download,
  Play,
  Route,
  Settings,
} from "lucide-react";
import type { ProjectTab } from "@/app/dashboard/projects/[id]/tab-state";

type NavItem = {
  tab: ProjectTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Analyze",
    items: [
      { tab: "overview", label: "Overview", icon: BarChart3 },
      { tab: "pages", label: "Pages", icon: FileText },
      { tab: "issues", label: "Issues", icon: Bug },
      { tab: "history", label: "History", icon: History },
    ],
  },
  {
    label: "Grow",
    items: [
      { tab: "strategy", label: "Strategy", icon: Compass },
      { tab: "competitors", label: "Competitors", icon: Trophy },
      { tab: "ai-visibility", label: "AI Visibility", icon: Bot },
      { tab: "ai-analysis", label: "AI Analysis", icon: Radar },
      { tab: "visibility", label: "Visibility", icon: Eye },
      { tab: "personas", label: "Personas", icon: User },
      { tab: "keywords", label: "Keywords", icon: Key },
    ],
  },
  {
    label: "Operate",
    items: [
      { tab: "integrations", label: "Integrations", icon: Plug },
      { tab: "reports", label: "Reports", icon: Download },
      { tab: "automation", label: "Automation", icon: Play },
      { tab: "logs", label: "Logs", icon: Route },
    ],
  },
];

const SETTINGS_ITEM: NavItem = {
  tab: "settings",
  label: "Settings",
  icon: Settings,
};

interface ProjectSidebarProps {
  projectName: string;
  domain: string;
  currentTab: ProjectTab;
  onTabChange: (tab: ProjectTab) => void;
}

export function ProjectSidebar({
  projectName,
  domain,
  currentTab,
  onTabChange,
}: ProjectSidebarProps) {
  return (
    <aside className="hidden w-56 flex-shrink-0 border-r border-sidebar-border md:block">
      {/* Project header */}
      <div className="border-b border-sidebar-border px-4 py-4">
        <p className="truncate font-mono text-sm font-semibold">{domain}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {projectName}
        </p>
      </div>

      {/* Nav groups */}
      <nav className="flex flex-col gap-1 p-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-1 mt-3 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground first:mt-0">
              {group.label}
            </p>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.tab;
              return (
                <button
                  key={item.tab}
                  type="button"
                  onClick={() => onTabChange(item.tab)}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
                    isActive
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}

        {/* Settings (ungrouped, separated by divider) */}
        <div className="mt-2 border-t border-sidebar-border pt-2">
          <button
            type="button"
            onClick={() => onTabChange(SETTINGS_ITEM.tab)}
            className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
              currentTab === SETTINGS_ITEM.tab
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <SETTINGS_ITEM.icon className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{SETTINGS_ITEM.label}</span>
          </button>
        </div>
      </nav>
    </aside>
  );
}
