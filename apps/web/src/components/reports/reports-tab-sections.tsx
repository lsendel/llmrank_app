import { Download, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ReportsTabLoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export function ReportsTabToolbar({
  crawlJobId,
  onExport,
  onOpenGenerate,
}: {
  crawlJobId?: string;
  onExport: (format: "csv" | "json") => void | Promise<void>;
  onOpenGenerate: () => void;
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={!crawlJobId}>
              <Download className="mr-2 h-4 w-4" />
              Export Data
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => void onExport("csv")}>
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void onExport("json")}>
              Export as JSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button onClick={onOpenGenerate} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New Report
        </Button>
      </div>
      {!crawlJobId && (
        <p className="text-xs text-muted-foreground">
          Run a crawl first to generate reports
        </p>
      )}
    </div>
  );
}
