import { useCallback, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { api, type VisibilityGap } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { type DiscoveryResult } from "./ai-visibility-tab-helpers";

type UseAIVisibilityTabActionsArgs = {
  projectId: string;
  gaps?: VisibilityGap[];
};

export function useAIVisibilityTabActions({
  projectId,
  gaps,
}: UseAIVisibilityTabActionsArgs) {
  const { withAuth } = useApi();
  const { toast } = useToast();
  const [discovering, setDiscovering] = useState(false);
  const [trackingGaps, setTrackingGaps] = useState(false);
  const [discoveryResult, setDiscoveryResult] =
    useState<DiscoveryResult | null>(null);

  const handleDiscover = useCallback(async () => {
    setDiscovering(true);
    try {
      await withAuth(async () => {
        const result = await api.visibility.discoverKeywords(projectId);
        setDiscoveryResult(result);
      });
    } catch (err) {
      toast({
        title: "Keyword discovery failed",
        description:
          err instanceof Error ? err.message : "Please try again shortly.",
        variant: "destructive",
      });
    } finally {
      setDiscovering(false);
    }
  }, [projectId, toast, withAuth]);

  const handleTrackGapsAsKeywords = useCallback(async () => {
    if (!gaps || gaps.length === 0) return;

    setTrackingGaps(true);
    try {
      await withAuth(async () => {
        const queries = gaps.map((gap) => gap.query);
        const created = await api.keywords.createBatch(projectId, queries);
        toast({
          title: "Keywords saved",
          description: `${created.length} gap queries added as tracked keywords.`,
        });
      });
    } catch (err) {
      toast({
        title: "Failed to save gap keywords",
        description:
          err instanceof Error ? err.message : "Please try again shortly.",
        variant: "destructive",
      });
    } finally {
      setTrackingGaps(false);
    }
  }, [gaps, projectId, toast, withAuth]);

  return {
    discovering,
    trackingGaps,
    discoveryResult,
    handleDiscover,
    handleTrackGapsAsKeywords,
  };
}
