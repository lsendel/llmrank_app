"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink, Link2 } from "lucide-react";

interface BacklinkCardProps {
  summary: {
    domain: string;
    totalBacklinks: number;
    referringDomains: number;
    dofollowRatio: number;
    topReferringDomains: {
      domain: string;
      linkCount: number;
      latestAnchor: string | null;
      firstSeen: string;
    }[];
  } | null;
  isLoading: boolean;
}

export function BacklinkCard({ summary, isLoading }: BacklinkCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4" />
            Backlink Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-4 w-48 animate-pulse rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary || summary.totalBacklinks === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4" />
            Backlink Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No backlinks discovered yet. Your profile grows as more sites are
            crawled across the LLM Boost network.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4" />
          Backlink Profile
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary stats */}
        <div className="mb-4 grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold">{summary.totalBacklinks}</p>
            <p className="text-xs text-muted-foreground">Total Backlinks</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{summary.referringDomains}</p>
            <p className="text-xs text-muted-foreground">Referring Domains</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">
              {Math.round(summary.dofollowRatio * 100)}%
            </p>
            <p className="text-xs text-muted-foreground">Dofollow</p>
          </div>
        </div>

        {/* Top referring domains */}
        {summary.topReferringDomains.length > 0 && (
          <>
            <h4 className="mb-2 text-sm font-medium">Top Referring Domains</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead className="text-right">Links</TableHead>
                  <TableHead>Anchor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.topReferringDomains.slice(0, 10).map((rd) => (
                  <TableRow key={rd.domain}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        {rd.domain}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{rd.linkCount}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                      {rd.latestAnchor ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          Based on sites analyzed across the LLM Boost network. Your backlink
          profile grows as more sites are crawled.
        </p>
      </CardContent>
    </Card>
  );
}
