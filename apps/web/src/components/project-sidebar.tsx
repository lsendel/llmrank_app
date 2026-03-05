"use client";

import { useMemo } from "react";
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
import type { ProjectTabGroup } from "@/app/dashboard/projects/[id]/tab-state";
import {
  resolveProjectGroupOrder,
  resolveProjectTabOrder,
  type PersonalizationContext,
} from "@/lib/personalization-layout";

type NavItem = {
  tab: ProjectTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavGroup = {
  id: ProjectTabGroup;
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: "analyze",
    label: "Analyze",
    items: [
      { tab: "overview", label: "Overview", icon: BarChart3 },
      { tab: "actions", label: "Actions", icon: Zap },
      { tab: "pages", label: "Pages", icon: FileText },
      { tab: "issues", label: "Issues", icon: Bug },
      { tab: "history", label: "History", icon: History },
    ],
  },
  {
    id: "grow-visibility",
    label: "Grow Visibility",
    items: [
      { tab: "strategy", label: "Strategy", icon: Compass },
      { tab: "competitors", label: "Competitors", icon: Trophy },
      { tab: "visibility", label: "Visibility Hub", icon: Bot },
      { tab: "personas", label: "Personas", icon: User },
      { tab: "keywords", label: "Keywords", icon: Key },
    ],
  },
  {
    id: "automate-operate",
    label: "Automate & Operate",
    items: [
      { tab: "integrations", label: "Integrations", icon: Plug },
      { tab: "reports", label: "Reports", icon: Download },
      { tab: "automation", label: "Automation", icon: Play },
      { tab: "logs", label: "Logs", icon: Route },
    ],
  },
  {
    id: "configure",
    label: "Configure",
    items: [{ tab: "settings", label: "Settings", icon: Settings }],
  },
];

interface ProjectSidebarProps {
  projectName: string;
  domain: string;
  currentTab: ProjectTab;
  onTabChange: (tab: ProjectTab) => void;
  personalizationContext?: PersonalizationContext;
}

function isVisibilityTab(tab: ProjectTab): boolean {
  return (
    tab === "visibility" || tab === "ai-visibility" || tab === "ai-analysis"
  );
}

export function ProjectSidebar({
  projectName,
  domain,
  currentTab,
  onTabChange,
  personalizationContext,
}: ProjectSidebarProps) {
  const orderedGroups = useMemo(() => {
    const groupsById = new Map(NAV_GROUPS.map((group) => [group.id, group]));

    return resolveProjectGroupOrder(personalizationContext)
      .map((groupId) => groupsById.get(groupId))
      .filter((group): group is NavGroup => Boolean(group))
      .map((group) => {
        const tabs = resolveProjectTabOrder(
          group.items.map((item) => item.tab),
          personalizationContext,
        );
        const itemsByTab = new Map(group.items.map((item) => [item.tab, item]));
        return {
          ...group,
          items: tabs
            .map((tab) => itemsByTab.get(tab))
            .filter((item): item is NavItem => Boolean(item)),
        };
      });
  }, [personalizationContext]);

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
        {orderedGroups.map((group) => (
          <div key={group.id}>
            <p className="mb-1 mt-3 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground first:mt-0">
              {group.label}
            </p>
            {group.items.map((item) => {
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
      </nav>
    </aside>
  );
}
