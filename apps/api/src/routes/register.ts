import type { Hono } from "hono";
import type { AppEnv } from "../index";
import { createAuth } from "../lib/auth";

import { healthRoutes } from "./health";
import { projectRoutes } from "./projects";
import { crawlRoutes } from "./crawls";
import { queueRoutes } from "./queue";
import { pageRoutes } from "./pages";
import { billingRoutes } from "./billing";
import { ingestRoutes } from "./ingest";
import { visibilityRoutes } from "./visibility";
import { scoreRoutes } from "./scores";
import { dashboardRoutes } from "./dashboard";
import { accountRoutes } from "./account";
import { publicRoutes } from "./public";
import { adminRoutes } from "./admin";
import { logRoutes } from "./logs";
import { extractorRoutes } from "./extractors";
import { integrationRoutes } from "./integrations";
import { strategyRoutes } from "./strategy";
import { browserRoutes } from "./browser";
import { insightsRoutes } from "./insights";
import { reportRoutes } from "./reports";
import { reportUploadRoutes } from "./report-upload";
import { fixRoutes } from "./fixes";
import { competitorWatchlistRoutes } from "./competitor-watchlist";
import { competitorRoutes } from "./competitors";
import { trendRoutes } from "./trends";
import { notificationChannelRoutes } from "./notification-channels";
import { visibilityScheduleRoutes } from "./visibility-schedules";
import { tokenRoutes } from "./api-tokens";
import { v1Routes } from "./v1";
import { scoringProfileRoutes } from "./scoring-profiles";
import { brandingRoutes } from "./branding";
import { exportRoutes } from "./exports";
import { generatorRoutes } from "./generators";
import { teamRoutes } from "./teams";
import { organizationRoutes } from "./organizations";
import { backlinkRoutes } from "./backlinks";
import { personaRoutes } from "./personas";
import { keywordRoutes } from "./keywords";
import { discoveryRoutes } from "./discovery";
import { narrativeRoutes } from "./narratives";
import { actionItemRoutes } from "./action-items";
import { alertRoutes } from "./alerts";
import { pipelineRoutes } from "./pipeline";
import { trialRoutes } from "./trial";
import { brandPerformanceRoutes } from "./brand-performance";
import { promptResearchRoutes } from "./prompt-research";
import { wizardRoutes } from "./wizard";
import { connectRoutes } from "./connect";
import { appRoutes } from "./app";
import { marketingRoutes } from "./marketing";

export function registerApiRoutes(app: Hono<AppEnv>) {
  app.route("/api/health", healthRoutes);
  app.route("/api/projects", projectRoutes);
  app.route("/api/projects", brandingRoutes);
  app.route("/api/projects", exportRoutes);
  app.route("/api/crawls", crawlRoutes);
  app.route("/api/queue", queueRoutes);
  app.route("/api/pages", pageRoutes);
  app.route("/api/billing", billingRoutes);
  app.route("/ingest", ingestRoutes);
  app.route("/api/visibility/schedules", visibilityScheduleRoutes);
  app.route("/api/visibility", visibilityRoutes);
  app.route("/api/scores", scoreRoutes);
  app.route("/api/dashboard", dashboardRoutes);
  app.route("/api/account", accountRoutes);
  app.route("/api/public", publicRoutes);
  app.route("/api/admin", adminRoutes);
  app.route("/api/logs", logRoutes);
  app.route("/api/extractors", extractorRoutes);
  app.route("/api/integrations", integrationRoutes);
  app.route("/api/strategy", strategyRoutes);
  app.route("/api/browser", browserRoutes);
  app.route("/api/crawls", insightsRoutes);
  app.route("/api/reports", reportRoutes);
  app.route("/api/fixes", fixRoutes);
  app.route("/api/competitors/watchlist", competitorWatchlistRoutes);
  app.route("/api/competitors", competitorRoutes);
  app.route("/api/trends", trendRoutes);
  app.route("/internal", reportUploadRoutes);
  app.route("/api/notification-channels", notificationChannelRoutes);
  app.route("/api/tokens", tokenRoutes);
  app.route("/api/v1", v1Routes);
  app.route("/api/scoring-profiles", scoringProfileRoutes);
  app.route("/api/projects", generatorRoutes);
  app.route("/api/teams", teamRoutes);
  app.route("/api/orgs", organizationRoutes);
  app.route("/api/backlinks", backlinkRoutes);
  app.route("/api/personas", personaRoutes);
  app.route("/api/keywords", keywordRoutes);
  app.route("/api/discovery", discoveryRoutes);
  app.route("/api/narratives", narrativeRoutes);
  app.route("/api/action-items", actionItemRoutes);
  app.route("/api/action-plan", actionItemRoutes);
  app.route("/api/alerts", alertRoutes);
  app.route("/api/pipeline", pipelineRoutes);
  app.route("/api/trial", trialRoutes);
  app.route("/api/brand", brandPerformanceRoutes);
  app.route("/api/prompt-research", promptResearchRoutes);
  app.route("/api/wizard", wizardRoutes);
}

export function registerFirstPartyRoutes(app: Hono<AppEnv>) {
  app.route("/connect", connectRoutes);
  app.route("/app", appRoutes);
  app.route("/", marketingRoutes);
}

export function registerAuthRoutes(app: Hono<AppEnv>) {
  app.on(["POST", "GET"], "/api/auth/*", (c) => {
    const auth = createAuth(c.env);
    return auth.handler(c.req.raw);
  });
}
