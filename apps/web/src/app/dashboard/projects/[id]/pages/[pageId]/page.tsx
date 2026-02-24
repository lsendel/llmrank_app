"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Globe,
  Code2,
  FileText,
  LayoutList,
  Gauge,
  Bug,
  Brain,
  Plug,
  Wand2,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageOverviewSection } from "@/components/page-detail/page-overview-section";
import { PageTechnicalSection } from "@/components/page-detail/page-technical-section";
import { PageContentSection } from "@/components/page-detail/page-content-section";
import { PagePerformanceSection } from "@/components/page-detail/page-performance-section";
import { PageIssuesSection } from "@/components/page-detail/page-issues-section";
import { PageLlmQualitySection } from "@/components/page-detail/page-llm-quality-section";
import { PageEnrichmentsSection } from "@/components/page-detail/page-enrichments-section";
import { PageOptimizationWorkspace } from "@/components/page-detail/page-optimization-workspace";
import { useApi } from "@/lib/use-api";
import { useLocalAI } from "@/lib/use-local-ai";
import { api, type PageScoreDetail, type PageEnrichment } from "@/lib/api";

const PageLinkGraphSection = dynamic(
  () =>
    import("@/components/page-detail/page-link-graph-section").then((m) => ({
      default: m.PageLinkGraphSection,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="py-8 text-center text-muted-foreground">
        Loading graph...
      </div>
    ),
  },
);

export default function PageDetailPage() {
  const params = useParams<{ id: string; pageId: string }>();
  const { withAuth } = useApi();

  const [page, setPage] = useState<PageScoreDetail | null>(null);
  const [enrichments, setEnrichments] = useState<PageEnrichment[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAvailable, generateText } = useLocalAI();
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, string>>(
    {},
  );
  const [analyzingField, setAnalyzingField] = useState<string | null>(null);
  const [extractedTopics, setExtractedTopics] = useState<string[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      withAuth(async () => {
        const data = await api.scores.getPage(params.pageId);
        setPage(data);
      }),
      withAuth(async () => {
        const data = await api.pages.getEnrichments(params.pageId);
        setEnrichments(data);
      }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [withAuth, params.pageId]);

  const handleAiSuggestion = async (
    field: "title" | "metaDesc",
    content: string,
  ) => {
    if (!content) return;
    setAnalyzingField(field);
    try {
      const prompt =
        field === "title"
          ? `Generate 3 better SEO titles for a page with this content: "${content.substring(0, 500)}...". Return only the titles, one per line.`
          : `Generate a better meta description (max 160 chars) for a page with this content: "${content.substring(0, 500)}...". Return only the description.`;

      const suggestion = await generateText(prompt);
      setAiSuggestions((prev) => ({ ...prev, [field]: suggestion }));
    } catch (e) {
      console.error("AI Generation failed", e);
    } finally {
      setAnalyzingField(null);
    }
  };

  const handleTopicExtraction = async () => {
    if (!page?.title) return;
    setTopicsLoading(true);
    try {
      const prompt = `Extract the top 5 key entities or topics from this page title and description: Title: "${page.title}", Desc: "${page.metaDesc}". Return as a comma-separated list.`;
      const result = await generateText(prompt);
      setExtractedTopics(result.split(",").map((t) => t.trim()));
    } catch (e) {
      console.error("Topic extraction failed", e);
    } finally {
      setTopicsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Loading page analysis...</p>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Page not found.</p>
      </div>
    );
  }

  const llmScores = (page.score?.detail ?? {}).llmContentScores as Record<
    string,
    number
  > | null;

  return (
    <div className="space-y-8">
      {/* Back + header */}
      <div>
        <Link
          href={`/dashboard/projects/${params.id}`}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Project
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Page Analysis</h1>
          <p className="mt-0.5 font-mono text-sm text-muted-foreground">
            {page.url}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">
            <Globe className="mr-1.5 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="technical">
            <Code2 className="mr-1.5 h-4 w-4" />
            Technical
          </TabsTrigger>
          <TabsTrigger value="content">
            <FileText className="mr-1.5 h-4 w-4" />
            Content
          </TabsTrigger>
          <TabsTrigger value="optimization">
            <Wand2 className="mr-1.5 h-4 w-4" />
            Optimization
          </TabsTrigger>
          <TabsTrigger value="structure">
            <LayoutList className="mr-1.5 h-4 w-4" />
            Structure
          </TabsTrigger>
          <TabsTrigger value="performance">
            <Gauge className="mr-1.5 h-4 w-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="issues">
            <Bug className="mr-1.5 h-4 w-4" />
            Issues ({page.issues.length})
          </TabsTrigger>
          {llmScores && (
            <TabsTrigger value="llm-quality">
              <Brain className="mr-1.5 h-4 w-4" />
              LLM Quality
            </TabsTrigger>
          )}
          {enrichments.length > 0 && (
            <TabsTrigger value="enrichments">
              <Plug className="mr-1.5 h-4 w-4" />
              Enrichments
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="space-y-6 pt-4">
          <PageOverviewSection page={page} />
        </TabsContent>

        <TabsContent value="technical" className="space-y-4 pt-4">
          <PageTechnicalSection
            page={page}
            isAiAvailable={isAvailable}
            analyzingField={analyzingField}
            aiSuggestions={aiSuggestions}
            onAiSuggestion={handleAiSuggestion}
          />
        </TabsContent>

        <TabsContent value="content" className="space-y-4 pt-4">
          <PageContentSection
            page={page}
            isAiAvailable={isAvailable}
            extractedTopics={extractedTopics}
            topicsLoading={topicsLoading}
            onTopicExtraction={handleTopicExtraction}
          />
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4 pt-4">
          <PageOptimizationWorkspace page={page} projectId={params.id} />
        </TabsContent>

        <TabsContent value="structure" className="space-y-4 pt-4">
          <PageLinkGraphSection page={page} />
        </TabsContent>

        <TabsContent value="performance" className="space-y-4 pt-4">
          <PagePerformanceSection page={page} />
        </TabsContent>

        <TabsContent value="issues" className="space-y-3 pt-4">
          <PageIssuesSection issues={page.issues} />
        </TabsContent>

        {llmScores && (
          <TabsContent value="llm-quality" className="space-y-4 pt-4">
            <PageLlmQualitySection scores={llmScores} />
          </TabsContent>
        )}

        {enrichments.length > 0 && (
          <TabsContent value="enrichments" className="space-y-4 pt-4">
            <PageEnrichmentsSection enrichments={enrichments} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
