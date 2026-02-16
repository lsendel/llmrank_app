"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn, gradeColor } from "@/lib/utils";

interface PageRow {
  url: string;
  title: string;
  overallScore: number;
  technicalScore: number;
  contentScore: number;
  aiReadinessScore: number;
  issueCount: number;
}

type SortKey =
  | "overallScore"
  | "technicalScore"
  | "contentScore"
  | "aiReadinessScore"
  | "issueCount";

export function SortablePageTable({ pages }: { pages: PageRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("overallScore");
  const [sortAsc, setSortAsc] = useState(false);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const sorted = [...pages].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    return sortAsc ? av - bv : bv - av;
  });

  const sortIcon = (col: SortKey) =>
    sortKey === col ? (sortAsc ? " \u2191" : " \u2193") : "";

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="min-w-[250px]">Page</TableHead>
            <TableHead
              className="cursor-pointer text-center select-none"
              onClick={() => handleSort("overallScore")}
            >
              Score
              {sortIcon("overallScore")}
            </TableHead>
            <TableHead
              className="cursor-pointer text-center select-none"
              onClick={() => handleSort("technicalScore")}
            >
              Tech
              {sortIcon("technicalScore")}
            </TableHead>
            <TableHead
              className="cursor-pointer text-center select-none"
              onClick={() => handleSort("contentScore")}
            >
              Content
              {sortIcon("contentScore")}
            </TableHead>
            <TableHead
              className="cursor-pointer text-center select-none"
              onClick={() => handleSort("aiReadinessScore")}
            >
              AI
              {sortIcon("aiReadinessScore")}
            </TableHead>
            <TableHead
              className="cursor-pointer text-center select-none"
              onClick={() => handleSort("issueCount")}
            >
              Issues
              {sortIcon("issueCount")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((page) => (
            <TableRow key={page.url}>
              <TableCell className="max-w-[350px]">
                <div className="truncate font-mono text-xs" title={page.url}>
                  {page.url}
                </div>
                {page.title && (
                  <div className="truncate text-xs text-muted-foreground mt-0.5">
                    {page.title}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-center">
                <span
                  className={cn(
                    "font-bold text-sm",
                    gradeColor(page.overallScore),
                  )}
                >
                  {Math.round(page.overallScore)}
                </span>
              </TableCell>
              <TableCell className="text-center text-sm">
                {Math.round(page.technicalScore)}
              </TableCell>
              <TableCell className="text-center text-sm">
                {Math.round(page.contentScore)}
              </TableCell>
              <TableCell className="text-center text-sm">
                {Math.round(page.aiReadinessScore)}
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className="font-normal text-xs">
                  {page.issueCount}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
