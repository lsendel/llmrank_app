import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerAllPrompts(server: McpServer): void {
  server.registerPrompt(
    "site-audit",
    {
      title: "Full Site Audit",
      description:
        "Perform a comprehensive AI-readiness audit of a site. Lists all projects, gets scores, identifies critical issues, and provides a prioritized action plan.",
      argsSchema: {
        projectId: z.string().uuid().describe("Project ID to audit"),
      },
    },
    ({ projectId }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Perform a comprehensive AI-readiness audit for project ${projectId}:

1. First, use get_site_score to get the overall score breakdown
2. Use list_issues with severity "critical" to find the most important problems
3. Use get_recommendations to get a prioritized action plan
4. Use check_llms_txt to validate the llms.txt file
5. Summarize findings with:
   - Current score and grade
   - Top 5 critical issues with their impact
   - Recommended fixes in priority order
   - Expected score improvement if fixes are applied`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "fix-plan",
    {
      title: "Create Fix Plan",
      description:
        "Create a detailed fix plan for the top issues on a site. Generates specific code/content fixes for each issue.",
      argsSchema: {
        projectId: z.string().uuid().describe("Project ID"),
        maxIssues: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .default(5)
          .describe("Maximum issues to create fixes for"),
      },
    },
    ({ projectId, maxIssues }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Create a fix plan for project ${projectId}:

1. Use list_issues to get all critical and warning issues
2. For the top ${maxIssues} issues by impact, use generate_fix to create specific fixes
3. Present each fix with:
   - Issue description and current impact
   - Exact code/content change needed
   - Expected score improvement
   - Implementation difficulty (low/medium/high)
4. Order fixes by effort-to-impact ratio (quick wins first)`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "competitor-analysis",
    {
      title: "Competitor Analysis",
      description:
        "Compare your site against competitors and identify areas where competitors outperform you in AI-readiness.",
      argsSchema: {
        projectId: z.string().uuid().describe("Project ID"),
      },
    },
    ({ projectId }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Analyze competitors for project ${projectId}:

1. Use list_competitors to see all tracked competitors with scores
2. For each competitor, use compare_competitor to get detailed comparison
3. Use get_content_gaps to find topics competitors cover that you don't
4. Summarize:
   - Your ranking among competitors
   - Categories where you lead vs. trail
   - Specific content gaps to address
   - Quick wins to overtake nearest competitor`,
          },
        },
      ],
    }),
  );
}
