import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiUrl } from "@/lib/api-base-url";
import { extractOrgIdFromPayload } from "../org-response";
import { normalizeSettingsTab } from "../tab-state";
import { buildSettingsTabQueryString } from "../settings-page-helpers";

export function useSettingsPageState() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgResolved, setOrgResolved] = useState(false);
  const [orgLoadError, setOrgLoadError] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawTab = searchParams.get("tab");
  const searchParamsString = searchParams.toString();
  const hasOrganizationAccess = orgResolved ? Boolean(orgId) : true;
  const activeTab = normalizeSettingsTab(rawTab, hasOrganizationAccess);

  const replaceTab = useCallback(
    (tab: ReturnType<typeof normalizeSettingsTab>) => {
      const qs = buildSettingsTabQueryString(searchParamsString, tab);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParamsString],
  );

  const loadOrganization = useCallback((reset = false) => {
    if (reset) {
      setOrgResolved(false);
      setOrgLoadError(false);
    }

    return fetch(apiUrl("/api/orgs"), { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        setOrgId(extractOrgIdFromPayload(json));
        setOrgLoadError(false);
      })
      .catch(() => {
        setOrgLoadError(true);
        setOrgId(null);
      })
      .finally(() => setOrgResolved(true));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOrganization();
  }, [loadOrganization]);

  useEffect(() => {
    if (!rawTab || !orgResolved) return;
    if (rawTab === activeTab) return;
    replaceTab(activeTab);
  }, [activeTab, orgResolved, rawTab, replaceTab]);

  const handleTabChange = useCallback(
    (value: string) => {
      const nextTab = normalizeSettingsTab(value, Boolean(orgId));
      replaceTab(nextTab);
    },
    [orgId, replaceTab],
  );

  const retryLoadOrganization = useCallback(() => {
    void loadOrganization(true);
  }, [loadOrganization]);

  return {
    activeTab,
    handleTabChange,
    orgId,
    orgLoadError,
    retryLoadOrganization,
  };
}
