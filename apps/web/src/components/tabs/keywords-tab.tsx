"use client";

import { useState, useEffect, useCallback } from "react";
import { api, type SavedKeyword } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { StateCard } from "@/components/ui/state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Key, Loader2, Search } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const FUNNEL_COLORS = {
  education: "bg-blue-100 text-blue-800",
  comparison: "bg-amber-100 text-amber-800",
  purchase: "bg-green-100 text-green-800",
};

const SOURCE_LABELS = {
  auto_discovered: "Auto",
  user_added: "Manual",
  perplexity: "Perplexity",
};

export function KeywordsTab({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [keywords, setKeywords] = useState<SavedKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyword, setNewKeyword] = useState("");
  const [newFunnel, setNewFunnel] = useState<string>("education");
  const [adding, setAdding] = useState(false);
  const [discovering, setDiscovering] = useState(false);

  const loadKeywords = useCallback(async () => {
    try {
      const data = await api.keywords.list(projectId);
      setKeywords(data);
    } catch (err) {
      toast({
        title: "Failed to load keywords",
        description:
          err instanceof Error ? err.message : "Please refresh and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadKeywords();
  }, [loadKeywords]);

  const handleAdd = async () => {
    if (!newKeyword.trim()) return;
    setAdding(true);
    try {
      const kw = await api.keywords.create(projectId, {
        keyword: newKeyword,
        funnelStage: newFunnel,
      });
      setKeywords((prev) => [kw, ...prev]);
      setNewKeyword("");
    } catch (err) {
      toast({
        title: "Failed to add keyword",
        description:
          err instanceof Error ? err.message : "Please try again shortly.",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.keywords.remove(id);
      setKeywords((prev) => prev.filter((k) => k.id !== id));
    } catch (err) {
      toast({
        title: "Failed to delete keyword",
        description:
          err instanceof Error ? err.message : "Please try again shortly.",
        variant: "destructive",
      });
    }
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      await api.visibility.discoverKeywords(projectId);
      await loadKeywords();
    } catch (err) {
      toast({
        title: "Discovery failed",
        description:
          err instanceof Error ? err.message : "Please try again shortly.",
        variant: "destructive",
      });
    } finally {
      setDiscovering(false);
    }
  };

  if (loading) {
    return (
      <StateCard
        variant="loading"
        title="Loading keywords"
        description="Fetching tracked keywords and funnel stages."
        contentClassName="p-0"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Tracked Keywords</h3>
          <p className="text-sm text-muted-foreground">
            Keywords used for AI visibility tracking. Run visibility checks
            against these.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleDiscover}
          disabled={discovering}
        >
          {discovering ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-1 h-4 w-4" />
          )}
          Discover More
        </Button>
      </div>

      {/* Add keyword form */}
      <div className="flex gap-2">
        <Input
          placeholder="Add a keyword..."
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="flex-1"
        />
        <Select value={newFunnel} onValueChange={setNewFunnel}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="education">Education</SelectItem>
            <SelectItem value="comparison">Comparison</SelectItem>
            <SelectItem value="purchase">Purchase</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleAdd} disabled={adding || !newKeyword.trim()}>
          {adding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </div>

      {keywords.length === 0 ? (
        <StateCard
          variant="empty"
          icon={<Key className="h-10 w-10 text-muted-foreground/70" />}
          description="No keywords saved yet. Add keywords or use Discover to find relevant ones."
          contentClassName="p-0"
        />
      ) : (
        <div className="space-y-2">
          {keywords.map((kw) => (
            <div
              key={kw.id}
              className="flex items-center justify-between rounded-lg border px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{kw.keyword}</span>
                {kw.funnelStage && (
                  <Badge
                    className={FUNNEL_COLORS[kw.funnelStage]}
                    variant="secondary"
                  >
                    {kw.funnelStage}
                  </Badge>
                )}
                <Badge variant="outline">{SOURCE_LABELS[kw.source]}</Badge>
                {kw.relevanceScore != null && (
                  <span className="text-xs text-muted-foreground">
                    {(kw.relevanceScore * 100).toFixed(0)}% relevant
                  </span>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => handleDelete(kw.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
