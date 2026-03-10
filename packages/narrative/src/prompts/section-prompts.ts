export const SECTION_PROMPTS: Record<string, string> = {
  executive_summary: `Write a 200-300 word executive summary of this website's AI readiness audit.
Include: the overall score and grade, the strongest and weakest category, the single most impactful finding, and a forward-looking statement about what improvement is possible.`,

  technical_analysis: `Write a 300-500 word analysis of the site's technical SEO health.
Cover: crawlability, indexability, schema markup, canonical setup, robots.txt/LLMs.txt, and any critical technical blockers. Reference the technical score and specific issues found.`,

  content_analysis: `Write a 300-500 word analysis of the site's content quality.
Cover: content depth (word count trends), clarity and readability scores, authority signals, structure quality, and citation worthiness. Reference the LLM content dimension scores.`,

  ai_readiness_analysis: `Write a 300-500 word analysis of the site's AI readiness.
Cover: discoverability by AI crawlers, content citeability, structured data for AI consumption, LLMs.txt presence, and AI crawler access. This is the most differentiating category for this platform.`,

  performance_analysis: `Write a 200-300 word analysis of the site's performance.
Cover: Core Web Vitals (LCP, FCP, CLS, TBT), Lighthouse scores, and how performance impacts both traditional SEO and AI crawler access.`,

  trend_analysis: `Write a 200-400 word trend analysis comparing the current crawl to the previous one.
Highlight: which scores improved or declined, the likely causes based on issue changes, and momentum indicators. Frame improvements positively and regressions as priorities.`,

  competitive_positioning: `Write a 200-400 word competitive positioning analysis.
Cover: how the site compares to tracked competitors in AI visibility, which competitors appear more frequently in LLM responses, and specific competitive gaps or advantages.`,

  priority_recommendations: `Write a 400-600 word prioritized action plan.
Structure as a numbered list of 5-8 recommendations ordered by ROI (score impact vs effort). Each recommendation should include: what to do, why it matters, expected score impact, and estimated effort level.`,
};

export const UNIFIED_REPORT_PROMPT = {
  system: `You are an AI SEO consultant generating a comprehensive, actionable audit report.

The report MUST include these sections in order:
1. Executive Summary (2-3 sentences, overall grade, biggest win, biggest risk)
2. Quick Wins (top 3-5 fixes that take <30 min each, with exact code/text to implement)
3. AI Visibility Status (which AI engines cite this site, for which queries, sentiment)
4. Structured Data Coverage (what schema.org types are present/missing, JSON-LD to add)
5. Competitive Position (vs selected competitors, where they win, where you win)
6. Priority Action Plan (ranked by impact×effort, grouped into: This Week, This Month, This Quarter)

Each action item MUST include:
- What to do (specific, not generic)
- Why it matters (quantified impact where possible)
- How to do it (code snippet, text to copy, or step-by-step)
- Estimated score improvement

Write for a marketing manager who can implement or delegate technical tasks.
Use bullet points, not paragraphs. Be specific, not vague.`,

  user: `Generate an actionable AI-readiness report for {{domain}}.

Scores: Overall {{overallScore}}/100 ({{grade}})
- Technical: {{technicalScore}} | Content: {{contentScore}}
- AI Readiness: {{aiReadinessScore}} | Performance: {{performanceScore}}

Top Issues:
{{topIssues}}

Structured Data Found: {{structuredDataFound}}
Structured Data Missing: {{structuredDataMissing}}

AI Crawler Status: {{crawlerStatus}}

Visibility Results: {{visibilityResults}}

Competitors: {{competitorAnalysis}}

Quick Wins Available: {{quickWins}}`,
};
