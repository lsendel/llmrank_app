"use client";

import { useMemo, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Maximize2, RefreshCcw, Download, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

// Dynamic import for force graph to avoid SSR issues
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

interface Node {
  id: string;
  label: string;
  score: number;
  wordCount: number;
  cluster: string;
  val: number; // For node sizing
  x?: number;
  y?: number;
}

interface Edge {
  source: string;
  target: string;
}

interface TopicMapData {
  nodes: Node[];
  edges: Edge[];
}

interface TopicClusterGraphProps {
  data: TopicMapData;
  className?: string;
}

const CLUSTER_COLORS = [
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#8b5cf6", // Violet
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#14b8a6", // Teal
  "#6366f1", // Indigo
];

export function TopicClusterGraph({ data, className }: TopicClusterGraphProps) {
  const fgRef = useRef<any>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const graphData = useMemo(() => {
    return {
      nodes: data.nodes.map((n) => ({ ...n })),
      links: data.edges.map((e) => ({ ...e })),
    };
  }, [data]);

  const clusterGroups = useMemo(() => {
    const groups: Record<string, number> = {};
    data.nodes.forEach((n) => {
      groups[n.cluster] = (groups[n.cluster] || 0) + 1;
    });
    return Object.entries(groups)
      .map(([label, count]) => ({ label, pageCount: count }))
      .sort((a, b) => b.pageCount - a.pageCount);
  }, [data]);

  const getClusterColor = (cluster: string) => {
    const idx = Math.abs(
      cluster.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0),
    );
    return CLUSTER_COLORS[idx % CLUSTER_COLORS.length];
  };

  return (
    <div className={cn("grid gap-4 lg:grid-cols-4", className)}>
      <Card className="lg:col-span-3">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base">Semantic Topic Map</CardTitle>
            <CardDescription>
              Cluster visualization of your site&apos;s internal authority.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => fgRef.current?.zoomToFit(400)}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8">
              <RefreshCcw className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative h-[500px] w-full overflow-hidden bg-slate-50/50 dark:bg-slate-900/20">
            <ForceGraph2D
              ref={fgRef}
              graphData={graphData}
              nodeLabel="label"
              nodeColor={(node: any) => getClusterColor(node.cluster)}
              nodeRelSize={6}
              nodeVal={(node: any) => Math.sqrt(node.val || 1) * 2}
              linkDirectionalParticles={2}
              linkDirectionalParticleSpeed={(d: any) => (d.value || 1) * 0.001}
              linkColor={() => "rgba(0,0,0,0.1)"}
              onNodeClick={(node: any) => setSelectedNode(node as Node)}
              cooldownTicks={100}
              nodeCanvasObject={(
                node: any,
                ctx: CanvasRenderingContext2D,
                globalScale: number,
              ) => {
                const label = node.label;
                const fontSize = 12 / globalScale;
                ctx.font = `${fontSize}px Sans-Serif`;
                const textWidth = ctx.measureText(label).width;
                const size = Math.sqrt(node.val || 1) * 2;

                ctx.fillStyle = getClusterColor(node.cluster);
                ctx.beginPath();
                ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
                ctx.fill();

                if (globalScale > 1.5) {
                  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
                  ctx.fillRect(
                    node.x - textWidth / 2 - 2,
                    node.y + size + 2,
                    textWidth + 4,
                    fontSize + 2,
                  );
                  ctx.textAlign = "center";
                  ctx.textBaseline = "middle";
                  ctx.fillStyle = "#333";
                  ctx.fillText(label, node.x, node.y + size + fontSize / 2 + 2);
                }
              }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Graph Insights</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedNode ? (
              <div className="animate-in fade-in slide-in-from-right-2">
                <div className="mb-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Selected Page
                  </p>
                  <p className="line-clamp-2 text-sm font-medium">
                    {selectedNode.label}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {selectedNode.id}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="text-[10px] uppercase text-muted-foreground">
                      LLM Score
                    </p>
                    <p
                      className={cn(
                        "text-lg font-bold",
                        selectedNode.score >= 80
                          ? "text-success"
                          : "text-warning",
                      )}
                    >
                      {selectedNode.score}%
                    </p>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="text-[10px] uppercase text-muted-foreground">
                      Words
                    </p>
                    <p className="text-lg font-bold">
                      {selectedNode.wordCount}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                    Cluster
                  </p>
                  <Badge variant="outline" className="mt-1 text-[10px]">
                    {selectedNode.cluster}
                  </Badge>
                </div>
                <Button
                  className="mt-4 h-8 w-full text-xs"
                  variant="outline"
                  onClick={() => setSelectedNode(null)}
                >
                  Clear Selection
                </Button>
              </div>
            ) : (
              <div>
                <p className="text-[11px] text-muted-foreground">
                  Click a node to inspect its relationship to the site&apos;s
                  semantic structure.
                </p>
                <div className="mt-4 space-y-3">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                    Top Clusters
                  </p>
                  {clusterGroups.slice(0, 5).map((c) => (
                    <div
                      key={c.label}
                      className="flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: getClusterColor(c.label) }}
                        />
                        <span className="font-medium">{c.label}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {c.pageCount} pages
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
              This graph visualizes your site&apos;s internal &quot;Semantic
              Authority.&quot; Pages with more incoming links are weighted
              higher in the cluster.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
