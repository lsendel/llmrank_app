"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import { 
  Maximize2, 
  Minimize2, 
  RefreshCw, 
  Info,
  Layers,
  ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Node {
  id: string;
  label: string;
  cluster: string;
  score: number;
  wordCount: number;
  x?: number;
  y?: number;
}

interface Edge {
  source: string;
  target: string;
  weight: number;
}

interface TopicClusterGraphProps {
  data: {
    nodes: Node[];
    edges: Edge[];
    clusters: { label: string; keywords: string[]; pageCount: number }[];
  };
}

export function TopicClusterGraph({ data }: TopicClusterGraphProps) {
  const fgRef = useRef<ForceGraphMethods>(undefined);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [hoverNode, setHoverNode] = useState<Node | null>(null);

  // Group nodes by cluster for the legend
  const clusters = useMemo(() => data.clusters, [data]);

  // Color scale for clusters
  const clusterColors = useMemo(() => {
    const colors = [
      "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", 
      "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#6366f1"
    ];
    const map: Record<string, string> = {};
    clusters.forEach((c, i) => {
      map[c.label] = colors[i % colors.length];
    });
    return map;
  }, [clusters]);

  const graphData = useMemo(() => ({
    nodes: data.nodes.map(n => ({ ...n })),
    links: data.edges.map(e => ({ ...e }))
  }), [data]);

  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force("charge")?.strength(-120);
      fgRef.current.d3Force("link")?.distance(50);
    }
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-4">
      <Card className="lg:col-span-3 overflow-hidden relative min-h-[600px] bg-background/50 border-primary/10">
        <CardHeader className="absolute top-0 left-0 right-0 z-10 bg-background/80 backdrop-blur-sm border-b border-primary/5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Semantic Topic Map
              </CardTitle>
              <CardDescription className="text-[10px]">
                Visualization of internal authority and topical clustering.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => fgRef.current?.zoomToFit(400)}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <div className="w-full h-full pt-16">
          <ForceGraph2D
            ref={fgRef}
            graphData={graphData}
            nodeLabel="label"
            nodeRelSize={6}
            nodeVal={(node: any) => Math.sqrt(node.wordCount || 100) / 5}
            nodeColor={(node: any) => clusterColors[node.cluster] || "#94a3b8"}
            linkColor={() => "rgba(var(--primary), 0.1)"}
            linkDirectionalArrowLength={3}
            linkDirectionalArrowRelPos={1}
            onNodeClick={(node: any) => setSelectedNode(node)}
            onNodeHover={(node: any) => setHoverNode(node)}
            backgroundColor="transparent"
            width={800}
            height={540}
            nodeCanvasObject={(node: any, ctx, globalScale) => {
              const label = node.label;
              const fontSize = 12 / globalScale;
              ctx.font = `${fontSize}px Sans-Serif`;
              const textWidth = ctx.measureText(label).width;
              const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2);

              const size = Math.sqrt(node.wordCount || 100) / 2;
              
              // Draw circle
              ctx.beginPath();
              ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
              ctx.fillStyle = clusterColors[node.cluster] || "#94a3b8";
              ctx.fill();

              // Highlight hover/selected
              if (node === hoverNode || node === selectedNode) {
                ctx.strokeStyle = "#fff";
                ctx.lineWidth = 2 / globalScale;
                ctx.stroke();
              }

              // Draw label if zoomed in
              if (globalScale > 1.5) {
                ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
                ctx.fillText(label, node.x - textWidth / 2, node.y + size + fontSize);
              }
            }}
          />
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 z-10 flex flex-wrap gap-2 max-w-[70%]">
          {clusters.map((c) => (
            <Badge 
              key={c.label} 
              variant="outline" 
              className="bg-background/80 backdrop-blur-sm text-[9px] border-primary/10"
              style={{ borderLeft: `4px solid ${clusterColors[c.label]}` }}
            >
              {c.label} ({c.pageCount})
            </Badge>
          ))}
        </div>
      </Card>

      {/* Info Sidebar */}
      <div className="space-y-6">
        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              {selectedNode ? "Page Details" : "Graph Insights"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedNode ? (
              <div className="space-y-4">
                <div>
                  <h4 className="font-bold text-sm leading-tight mb-1">{selectedNode.label}</h4>
                  <p className="text-[10px] font-mono text-muted-foreground break-all">{selectedNode.id}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded bg-muted/50">
                    <p className="text-[9px] uppercase font-bold text-muted-foreground">LLM Score</p>
                    <p className={cn("text-lg font-bold", 
                      selectedNode.score >= 80 ? "text-success" : "text-warning"
                    )}>{selectedNode.score}%</p>
                  </div>
                  <div className="p-2 rounded bg-muted/50">
                    <p className="text-[9px] uppercase font-bold text-muted-foreground">Words</p>
                    <p className="text-lg font-bold">{selectedNode.wordCount}</p>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Cluster</p>
                  <Badge variant="secondary" className="text-[10px]">{selectedNode.cluster}</Badge>
                </div>

                <Button className="w-full h-8 text-xs" variant="outline" asChild>
                  <a href={selectedNode.id} target="_blank" rel="noreferrer">
                    Open Page <Maximize2 className="ml-2 h-3 w-3" />
                  </a>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/10 text-[11px] leading-relaxed">
                  <div className="flex items-center gap-2 mb-2 text-primary font-bold">
                    <Info className="h-3 w-3" />
                    DID YOU KNOW?
                  </div>
                  LLMs use your internal link structure to determine "Contextual Authority." Pages with more incoming links are weighted higher in AI answers.
                </div>

                <div className="space-y-3">
                  <h5 className="text-[10px] font-bold uppercase text-muted-foreground">Top Clusters</h5>
                  {clusters.slice(0, 3).map(c => (
                    <div key={c.label} className="flex items-center justify-between text-xs">
                      <span className="font-medium truncate mr-2">{c.label}</span>
                      <span className="text-muted-foreground">{c.pageCount} pages</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedNode && (
          <Button variant="ghost" size="sm" className="w-full text-[10px]" onClick={() => setSelectedNode(null)}>
            Clear Selection
          </Button>
        )}
      </div>
    </div>
  );
}
