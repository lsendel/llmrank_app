import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import { Layers, TrendingUp, Users } from "lucide-react";

type HomePageLink = {
  href: string;
  label: string;
};

type HomePageTeam = {
  title: string;
  description: string;
  icon: LucideIcon;
};

type HomePageFactor = {
  name: string;
  weight: string;
  description: string;
  color: string;
};

type HomePageStep = {
  step: string;
  title: string;
  desc: string;
};

type HomePageStat = {
  value: string;
  description: string;
  valueClassName: string;
  descriptionClassName: string;
};

export const HOME_PAGE_METADATA: Metadata = {
  title:
    "Rank in ChatGPT, Claude & Perplexity | AI Search Optimization Platform",
  description:
    "LLM Rank analyses your website across 37 AI ranking factors. The first B2B platform for AI Search Optimization (AISO). Get your AI-Readiness Score today.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Rank in ChatGPT, Claude & Perplexity | LLM Rank",
    description:
      "The first AI Search Optimization (AISO) platform. Audit your website for AI-readiness and become the cited source in AI answers.",
    url: "https://llmrank.app",
    siteName: "LLM Rank",
    type: "website",
  },
};

export const HOME_PAGE_FAQ_ITEMS = [
  {
    question: "How do you rank in ChatGPT?",
    answer:
      "Websites rank in AI search engines by being technically optimized, well-structured, and citation-ready. LLMs prioritize authoritative content with clear entity relationships and direct answers.",
  },
  {
    question: "What is AI SEO?",
    answer:
      "AI SEO (or AISO) is the process of optimizing content to be found, understood, and cited by Generative AI models like ChatGPT, Claude, and Perplexity, rather than just ranking blue links in Google.",
  },
  {
    question: "How is AI search different from Google?",
    answer:
      "Google ranks links based on keywords and backlinks. AI search engines synthesize answers from multiple sources. To win in AI search, your content must be structured as reliable facts that an LLM can easily ingest and reference.",
  },
  {
    question: "What is an AI-Readiness score?",
    answer:
      "It is a proprietary metric from LLM Rank that evaluates a page across 37 factors including Technical SEO, Content Quality, AI Readiness, and Performance into a single 0-100 score.",
  },
];

export const HOME_PAGE_NAV_LINKS: HomePageLink[] = [
  { href: "/ai-seo-tool", label: "AI SEO Tool" },
  { href: "/pricing", label: "Pricing" },
];

export const HOME_PAGE_B2B_TEAMS: HomePageTeam[] = [
  {
    title: "SEO Agencies",
    description:
      "Offer a new high-value service: 'AI Visibility Audits' for your clients.",
    icon: Layers,
  },
  {
    title: "SaaS Marketing",
    description:
      "Ensure your product is recommended when users ask 'Best tool for X'.",
    icon: TrendingUp,
  },
  {
    title: "Content Teams",
    description: "Write content that LLMs love to read, understand, and cite.",
    icon: Users,
  },
];

export const HOME_PAGE_FACTORS: HomePageFactor[] = [
  {
    name: "Technical SEO",
    weight: "25%",
    description: "Schema, Robots, Canonical",
    color: "text-blue-500",
  },
  {
    name: "Content Structure",
    weight: "30%",
    description: "Entity Clarity, Direct Answers",
    color: "text-green-500",
  },
  {
    name: "AI Readiness",
    weight: "30%",
    description: "Citation Worthiness, Context",
    color: "text-purple-500",
  },
  {
    name: "Performance",
    weight: "15%",
    description: "Crawlability, Core Web Vitals",
    color: "text-orange-500",
  },
];

export const HOME_PAGE_PROBLEM_BULLETS = [
  'Most sites are invisible to ChatGPT due to "fluff" content.',
  "Poor entity structuring confuses LLM context windows.",
  "Technical blocks prevent AI bots from crawling critical data.",
];

export const HOME_PAGE_STEPS: HomePageStep[] = [
  {
    step: "1",
    title: "Enter your domain",
    desc: "Our crawlers simulate GPTBot and ClaudeBot to analyze your public pages.",
  },
  {
    step: "2",
    title: "Get your AI Score",
    desc: "See your site through the eyes of an LLM. Identify technical and content gaps.",
  },
  {
    step: "3",
    title: "Fix & Rank",
    desc: "Implement prioritized recommendations to become a trusted data source.",
  },
];

export const HOME_PAGE_STATS: HomePageStat[] = [
  {
    value: "40%+",
    description: "Queries influenced by AI by 2026",
    valueClassName: "text-blue-400",
    descriptionClassName: "text-blue-100",
  },
  {
    value: "0",
    description: 'Clicks for "Zero-Click" answers',
    valueClassName: "text-purple-400",
    descriptionClassName: "text-purple-100",
  },
  {
    value: "37",
    description: "Specific signals LLMs look for",
    valueClassName: "text-green-400",
    descriptionClassName: "text-green-100",
  },
];

export const HOME_PAGE_PLATFORM_LINKS: HomePageLink[] = [
  { href: "/scan", label: "Free Audit" },
  { href: "/pricing", label: "Pricing" },
  { href: "/ai-seo-tool", label: "AI SEO Tool" },
];

export const HOME_PAGE_RESOURCE_LINKS: HomePageLink[] = [
  { href: "/chatgpt-seo", label: "ChatGPT SEO Guide" },
  { href: "/audit/saas", label: "AI SEO for SaaS" },
  { href: "/privacy", label: "Privacy Policy" },
];
