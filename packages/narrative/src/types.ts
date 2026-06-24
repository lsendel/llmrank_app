import type {
  NarrativeSection,
  NarrativeSectionType,
  NarrativeTone,
} from "@llm-boost/shared";

export interface CategoryScores {
  technical: number;
  content: number;
  aiReadiness: number;
  performance: number;
}

export interface CrawlJobSummary {
  id: string;
  domain: string;
  overallScore: number;
  letterGrade: string;
  pagesScored: number;
  categoryScores: CategoryScores;
}

export interface IssueSummary {
  code: string;
  category: string;
  severity: string;
  message: string;
  recommendation: string;
  affectedPages: number;
  scoreImpact: number;
}

export interface QuickWin {
  code: string;
  message: string;
  recommendation: string;
  scoreImpact: number;
  pillar: string;
}

export interface ContentHealthMetrics {
  avgWordCount: number;
  avgClarity: number;
  avgAuthority: number;
  avgComprehensiveness: number;
  avgStructure: number;
  avgCitationWorthiness: number;
}

export interface CompetitorData {
  domain: string;
  mentionCount: number;
  platforms: string[];
  queries: string[];
}

export interface PageScoreSummary {
  url: string;
  title: string;
  overallScore: number;
  letterGrade: string;
  issueCount: number;
}

export interface PersonaContext {
  name: string;
  role: string;
  jobToBeDone?: string | null;
  sampleQueries?: string[];
}

export interface ProjectContext {
  name: string;
  siteDescription?: string | null;
  industry?: string | null;
  businessGoal?: string | null;
  siteContext?: unknown;
}

export interface NarrativeInput {
  tone: NarrativeTone;
  crawlJob: CrawlJobSummary;
  categoryScores: CategoryScores;
  issues: IssueSummary[];
  quickWins: QuickWin[];
  contentHealth: ContentHealthMetrics;
  projectContext?: ProjectContext;
  trackedKeywords?: string[];
  trackedCompetitors?: string[];
  personas?: PersonaContext[];
  previousCrawl?: CrawlJobSummary;
  competitors?: CompetitorData[];
  pages: PageScoreSummary[];
}

export interface NarrativeReport {
  sections: NarrativeSection[];
  tokenUsage: TokenUsage;
  generatedBy: string;
}

export interface TokenUsage {
  input: number;
  output: number;
  costCents: number;
}

export interface SectionGenerator {
  type: NarrativeSectionType;
  title: string;
  order: number;
  shouldGenerate(input: NarrativeInput): boolean;
  generate(input: NarrativeInput, model: string): Promise<NarrativeSection>;
}
