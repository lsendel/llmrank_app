export interface WeeklyDigestData {
  userName: string;
  projectName: string;
  domain: string;
  currentScore: number;
  previousScore: number | null;
  scoreDelta: number;
  letterGrade: string;
  newIssueCount: number;
  resolvedIssueCount: number;
  topQuickWins: Array<{ title: string; impact: number }>;
  dashboardUrl: string;
}

export function weeklyDigestHtml(data: WeeklyDigestData): string {
  const scoreColor =
    data.currentScore >= 80
      ? "#22c55e"
      : data.currentScore >= 60
        ? "#eab308"
        : "#ef4444";
  const deltaColor =
    data.scoreDelta > 0 ? "#22c55e" : data.scoreDelta < 0 ? "#ef4444" : "#666";
  const deltaPrefix = data.scoreDelta > 0 ? "+" : "";

  const quickWinsHtml =
    data.topQuickWins.length > 0
      ? data.topQuickWins
          .map(
            (w) => `
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #333;">${w.title}</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #6366f1; text-align: right; font-weight: 600;">+${w.impact}pts</td>
      </tr>
    `,
          )
          .join("")
      : `<tr><td style="padding: 12px 0; font-size: 14px; color: #999;">No quick wins this week</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #f4f4f5; font-family: system-ui, -apple-system, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
    <!-- Header -->
    <div style="text-align: center; padding: 24px 0;">
      <h1 style="margin: 0; font-size: 20px; color: #6366f1; font-weight: 700;">LLM Rank</h1>
      <p style="margin: 4px 0 0; font-size: 13px; color: #999;">Weekly AI-Readiness Digest</p>
    </div>

    <!-- Main card -->
    <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <p style="margin: 0 0 4px; font-size: 14px; color: #666;">Hi ${data.userName},</p>
      <p style="margin: 0 0 24px; font-size: 14px; color: #666;">Here's your weekly summary for <strong>${data.projectName}</strong> (${data.domain}).</p>

      <!-- Score -->
      <div style="text-align: center; background: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
        <div style="font-size: 14px; color: #666; margin-bottom: 8px;">Overall Score</div>
        <div style="font-size: 48px; font-weight: 700; color: ${scoreColor};">${data.letterGrade}</div>
        <div style="font-size: 24px; color: #333; margin-top: 4px;">${data.currentScore}/100</div>
        ${
          data.previousScore !== null
            ? `
          <div style="font-size: 14px; color: ${deltaColor}; margin-top: 8px; font-weight: 600;">
            ${deltaPrefix}${data.scoreDelta} pts from last week
          </div>
        `
            : ""
        }
      </div>

      <!-- Issue stats -->
      <div style="display: flex; gap: 16px; margin-bottom: 24px;">
        <div style="flex: 1; text-align: center; background: #f0fdf4; border-radius: 8px; padding: 16px;">
          <div style="font-size: 24px; font-weight: 700; color: #22c55e;">${data.resolvedIssueCount}</div>
          <div style="font-size: 12px; color: #666;">Resolved</div>
        </div>
        <div style="flex: 1; text-align: center; background: #fef2f2; border-radius: 8px; padding: 16px;">
          <div style="font-size: 24px; font-weight: 700; color: #ef4444;">${data.newIssueCount}</div>
          <div style="font-size: 12px; color: #666;">New Issues</div>
        </div>
      </div>

      <!-- Quick wins -->
      <h3 style="margin: 0 0 12px; font-size: 16px; color: #333;">Top Quick Wins</h3>
      <table style="width: 100%; border-collapse: collapse;">
        ${quickWinsHtml}
      </table>

      <!-- CTA -->
      <div style="text-align: center; margin-top: 24px;">
        <a href="${data.dashboardUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
          View Dashboard
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #999;">
      <p>You're receiving this because you have weekly digests enabled.</p>
      <p>
        <a href="${data.dashboardUrl.replace(/\/projects\/.*/, "/settings")}" style="color: #6366f1;">Manage preferences</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}
