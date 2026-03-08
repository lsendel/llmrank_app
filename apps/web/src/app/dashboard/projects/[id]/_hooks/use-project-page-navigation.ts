import { useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GROUP_DEFAULT_TABS,
  normalizeProjectTab,
  projectTabGroup,
  type ProjectTab,
  type ProjectTabGroup,
} from "../tab-state";
import {
  normalizeConfigureSection,
  type ConfigureSection,
} from "../configure-state";
import {
  asIntegrationProvider,
  asVisibilityMode,
  isVisibilityMode,
  parseWorkspaceStoredTab,
  visibilityModeStorageKey,
  workspaceLastTabStorageKey,
  type VisibilityMode,
} from "../project-page-helpers";

export function useProjectPageNavigation(projectId: string) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawTab = searchParams.get("tab");
  const rawConfigure = searchParams.get("configure");
  const requestedCrawlId = searchParams.get("crawlId");
  const connectProvider = asIntegrationProvider(searchParams.get("connect"));
  const connectedProvider = asIntegrationProvider(
    searchParams.get("connected"),
  );
  const currentTab = normalizeProjectTab(rawTab);
  const currentWorkspace = projectTabGroup(currentTab);
  const visibilityMode: VisibilityMode = isVisibilityMode(currentTab)
    ? currentTab
    : "visibility";
  const currentConfigureSection = normalizeConfigureSection(rawConfigure);
  const autoCrawlFailed = searchParams.get("autocrawl") === "failed";

  useEffect(() => {
    if (!rawTab || rawTab === currentTab) return;

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tab", currentTab);
    router.replace(`/dashboard/projects/${projectId}?${nextParams.toString()}`);
  }, [currentTab, projectId, rawTab, router, searchParams]);

  useEffect(() => {
    if (!rawConfigure || rawConfigure === currentConfigureSection) return;

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("configure", currentConfigureSection);
    router.replace(`/dashboard/projects/${projectId}?${nextParams.toString()}`);
  }, [currentConfigureSection, projectId, rawConfigure, router, searchParams]);

  useEffect(() => {
    if (!isVisibilityMode(currentTab) || typeof window === "undefined") return;
    window.localStorage.setItem(
      visibilityModeStorageKey(projectId),
      currentTab,
    );
  }, [currentTab, projectId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      workspaceLastTabStorageKey(projectId, currentWorkspace),
      currentTab,
    );
  }, [currentTab, currentWorkspace, projectId]);

  const resolveVisibilityModeTab = useCallback((): VisibilityMode => {
    if (isVisibilityMode(currentTab)) return currentTab;
    if (typeof window === "undefined") return "visibility";
    return (
      asVisibilityMode(
        window.localStorage.getItem(visibilityModeStorageKey(projectId)),
      ) ?? "visibility"
    );
  }, [currentTab, projectId]);

  const resolveWorkspaceTab = useCallback(
    (workspace: ProjectTabGroup): ProjectTab => {
      if (projectTabGroup(currentTab) === workspace) return currentTab;
      if (typeof window === "undefined") return GROUP_DEFAULT_TABS[workspace];

      const stored = parseWorkspaceStoredTab(
        window.localStorage.getItem(
          workspaceLastTabStorageKey(projectId, workspace),
        ),
        workspace,
      );
      return stored ?? GROUP_DEFAULT_TABS[workspace];
    },
    [currentTab, projectId],
  );

  const setProjectTab = useCallback(
    (tab: ProjectTab, mode: "push" | "replace" = "push") => {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set("tab", tab);
      const url = `/dashboard/projects/${projectId}?${nextParams.toString()}`;

      if (mode === "replace") {
        router.replace(url);
        return;
      }

      router.push(url);
    },
    [projectId, router, searchParams],
  );

  const handleTabChange = useCallback(
    (tab: ProjectTab) => {
      if (tab === "visibility") {
        setProjectTab(resolveVisibilityModeTab());
        return;
      }

      setProjectTab(tab);
    },
    [resolveVisibilityModeTab, setProjectTab],
  );

  const handleVisibilityModeChange = useCallback(
    (mode: VisibilityMode) => {
      setProjectTab(mode);
    },
    [setProjectTab],
  );

  const handleWorkspaceChange = useCallback(
    (workspace: ProjectTabGroup) => {
      setProjectTab(resolveWorkspaceTab(workspace));
    },
    [resolveWorkspaceTab, setProjectTab],
  );

  const setConfigureSection = useCallback(
    (section: ConfigureSection, mode: "push" | "replace" = "replace") => {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set("configure", section);
      const url = `/dashboard/projects/${projectId}?${nextParams.toString()}`;

      if (mode === "push") {
        router.push(url);
        return;
      }

      router.replace(url);
    },
    [projectId, router, searchParams],
  );

  const openAutomationDefaults = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tab", "settings");
    nextParams.set("configure", "crawl-defaults");
    router.push(`/dashboard/projects/${projectId}?${nextParams.toString()}`);
  }, [projectId, router, searchParams]);

  return {
    autoCrawlFailed,
    connectProvider,
    connectedProvider,
    currentConfigureSection,
    currentTab,
    currentWorkspace,
    handleTabChange,
    handleVisibilityModeChange,
    handleWorkspaceChange,
    openAutomationDefaults,
    requestedCrawlId,
    setConfigureSection,
    setProjectTab,
    visibilityMode,
  };
}
