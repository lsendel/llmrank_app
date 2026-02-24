"use client";

import { useState, useEffect, useCallback } from "react";
import { api, type Persona } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Sparkles, Trash2, User, Loader2, Wand2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const FUNNEL_COLORS = {
  education: "bg-blue-100 text-blue-800",
  comparison: "bg-amber-100 text-amber-800",
  purchase: "bg-green-100 text-green-800",
};

export function PersonasTab({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refining, setRefining] = useState<string | null>(null);

  const loadPersonas = useCallback(async () => {
    try {
      const data = await api.personas.list(projectId);
      setPersonas(data);
    } catch (err) {
      toast({
        title: "Failed to load personas",
        description:
          err instanceof Error ? err.message : "Please refresh and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadPersonas();
  }, [loadPersonas]);

  const handleGenerate = async () => {
    if (!roleName.trim()) return;
    setGenerating(true);
    try {
      const generated = await api.personas.generate(projectId, roleName);
      const persona = await api.personas.create(projectId, {
        ...generated,
        name: generated.name ?? roleName,
        role: generated.role ?? roleName,
      });
      setPersonas((prev) => [persona, ...prev]);
      setRoleName("");
      setShowAddDialog(false);
    } catch (err) {
      toast({
        title: "Failed to generate persona",
        description:
          err instanceof Error ? err.message : "Please try again shortly.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleRefine = async (id: string) => {
    setRefining(id);
    try {
      const suggestions = await api.personas.refine(id);
      const updated = await api.personas.update(id, suggestions);
      setPersonas((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (err) {
      toast({
        title: "Failed to refine persona",
        description:
          err instanceof Error ? err.message : "Please try again shortly.",
        variant: "destructive",
      });
    } finally {
      setRefining(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.personas.remove(id);
      setPersonas((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      toast({
        title: "Failed to delete persona",
        description:
          err instanceof Error ? err.message : "Please try again shortly.",
        variant: "destructive",
      });
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
          <h3 className="text-lg font-semibold">Audience Personas</h3>
          <p className="text-sm text-muted-foreground">
            Define who searches for your product in AI engines. Each persona
            generates targeted queries for visibility tracking.
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" />
              Add Persona
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Persona with AI</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Role Name</label>
                <Input
                  placeholder="e.g., Marketing Director, Small Business Owner"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  AI will generate a complete persona card from this role.
                </p>
              </div>
              <Button
                onClick={handleGenerate}
                disabled={generating || !roleName.trim()}
                className="w-full"
              >
                {generating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Generate Persona
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {personas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No personas yet. Add one to start tracking AI visibility by
              audience segment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {personas.map((persona) => (
            <Card
              key={persona.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() =>
                setExpandedId(expandedId === persona.id ? null : persona.id)
              }
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {persona.avatarUrl ? (
                      <img
                        src={persona.avatarUrl}
                        alt={persona.name}
                        className="h-10 w-10 rounded-full"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <User className="h-5 w-5" />
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-base">
                        {persona.name}
                      </CardTitle>
                      <CardDescription>{persona.role}</CardDescription>
                    </div>
                  </div>
                  <Badge
                    className={FUNNEL_COLORS[persona.funnelStage]}
                    variant="secondary"
                  >
                    {persona.funnelStage}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {persona.jobToBeDone && (
                  <p className="mb-2 text-sm text-muted-foreground">
                    {persona.jobToBeDone}
                  </p>
                )}
                <div className="text-xs text-muted-foreground">
                  {persona.sampleQueries.length} sample queries
                </div>

                {expandedId === persona.id && (
                  <div className="mt-4 space-y-3 border-t pt-4">
                    {persona.constraints && (
                      <div>
                        <p className="text-xs font-medium">Constraints</p>
                        <p className="text-xs text-muted-foreground">
                          {persona.constraints}
                        </p>
                      </div>
                    )}
                    {persona.successMetrics && (
                      <div>
                        <p className="text-xs font-medium">Success Metrics</p>
                        <p className="text-xs text-muted-foreground">
                          {persona.successMetrics}
                        </p>
                      </div>
                    )}
                    {persona.sampleQueries.length > 0 && (
                      <div>
                        <p className="text-xs font-medium">Sample Queries</p>
                        <ul className="mt-1 space-y-1">
                          {persona.sampleQueries.map((q, i) => (
                            <li
                              key={i}
                              className="text-xs text-muted-foreground"
                            >
                              &ldquo;{q}&rdquo;
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRefine(persona.id);
                        }}
                        disabled={refining === persona.id}
                      >
                        {refining === persona.id ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <Wand2 className="mr-1 h-3 w-3" />
                        )}
                        AI Refine
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(persona.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
