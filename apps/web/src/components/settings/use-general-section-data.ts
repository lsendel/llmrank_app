import { useCallback } from "react";
import {
  api,
  type DigestPreferences,
  type NotificationPreferences,
} from "@/lib/api";
import { useApiSWR } from "@/lib/use-api-swr";
import { formatPlanName } from "./general-section-helpers";

export function useGeneralSectionData() {
  const { data: me } = useApiSWR(
    "account-me",
    useCallback(() => api.account.getMe(), []),
  );
  const { data: notifications, mutate: mutateNotifications } =
    useApiSWR<NotificationPreferences>(
      "account-notifications",
      useCallback(() => api.account.getNotifications(), []),
    );
  const { data: digestPrefs, mutate: mutateDigest } =
    useApiSWR<DigestPreferences>(
      "account-digest",
      useCallback(() => api.account.getDigestPreferences(), []),
    );
  const { data: projectsData } = useApiSWR(
    "settings-projects",
    useCallback(() => api.projects.list({ limit: 100 }), []),
  );

  return {
    me,
    planName: formatPlanName(me?.plan),
    notifications,
    mutateNotifications,
    digestPrefs,
    mutateDigest,
    projectsList: projectsData?.data ?? [],
  };
}
