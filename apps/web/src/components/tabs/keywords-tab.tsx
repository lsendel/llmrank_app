"use client";

import { useState, useEffect, useCallback } from "react";
import { api, type SavedKeyword } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Key, Loader2, Search } from "lucide-react";

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
    } catch {
      // handle error
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
    } catch {
      // handle error
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.keywords.remove(id);
      setKeywords((prev) => prev.filter((k) => k.id !== id));
    } catch {
      // handle error
    }
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      await api.visibility.discoverKeywords(projectId);
      await loadKeywords();
    } catch {
      // handle error
    } finally {
      setDiscovering(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
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
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Key className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No keywords saved yet. Add keywords or use Discover to find
              relevant ones.
            </p>
          </CardContent>
        </Card>
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
