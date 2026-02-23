export interface MonthlyDigestData {
  userName: string;
  projects: Array<{
    name: string;
    domain: string;
    currentScore: number;
    previousScore: number | null;
    scoreDelta: number;
    letterGrade: string;
    issueCount: number;
  }>;
  settingsUrl: string;
  dashboardUrl: string;
}

export function monthlyDigestHtml(data: MonthlyDigestData): string {
  const projectsHtml = data.projects
    .map((p) => {
      const scoreColor =
        p.currentScore >= 80
          ? "#22c55e"
          : p.currentScore >= 60
            ? "#eab308"
            : "#ef4444";
      const deltaColor =
        p.scoreDelta > 0 ? "#22c55e" : p.scoreDelta < 0 ? "#ef4444" : "#666";
      const deltaPrefix = p.scoreDelta > 0 ? "+" : "";

      return `
      <tr>
        <td style="padding: 12px 8px; border-bottom: 1px solid #f0f0f0;">
          <div style="font-weight: 600; color: #333; font-size: 14px;">${p.name}</div>
          <div style="font-size: 12px; color: #999;">${p.domain}</div>
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #f0f0f0; text-align: center;">
          <span style="font-size: 20px; font-weight: 700; color: ${scoreColor};">${p.letterGrade}</span>
          <div style="font-size: 12px; color: #666;">${p.currentScore}/100</div>
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #f0f0f0; text-align: right;">
          ${
            p.previousScore !== null
              ? `
            <span style="font-size: 14px; font-weight: 600; color: ${deltaColor};">${deltaPrefix}${p.scoreDelta}</span>
          `
              : '<span style="font-size: 12px; color: #999;">New</span>'
          }
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #f0f0f0; text-align: right;">
          <span style="font-size: 14px; color: #666;">${p.issueCount}</span>
        </td>
      </tr>
    `;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #f4f4f5; font-family: system-ui, -apple-system, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
    <div style="text-align: center; padding: 24px 0;">
      <h1 style="margin: 0; font-size: 20px; color: #6366f1; font-weight: 700;">LLM Rank</h1>
      <p style="margin: 4px 0 0; font-size: 13px; color: #999;">Monthly AI-Readiness Report</p>
    </div>

    <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <p style="margin: 0 0 24px; font-size: 14px; color: #666;">Hi ${data.userName}, here's your monthly overview across all projects.</p>

      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 2px solid #e5e5e5;">
            <th style="padding: 8px; text-align: left; font-size: 12px; color: #999; text-transform: uppercase;">Project</th>
            <th style="padding: 8px; text-align: center; font-size: 12px; color: #999; text-transform: uppercase;">Score</th>
            <th style="padding: 8px; text-align: right; font-size: 12px; color: #999; text-transform: uppercase;">Change</th>
            <th style="padding: 8px; text-align: right; font-size: 12px; color: #999; text-transform: uppercase;">Issues</th>
          </tr>
        </thead>
        <tbody>
          ${projectsHtml}
        </tbody>
      </table>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${data.dashboardUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
          View Dashboard
        </a>
      </div>
    </div>

    <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #999;">
      <p>You're receiving this because you have monthly digests enabled.</p>
      <p><a href="${data.settingsUrl}" style="color: #6366f1;">Manage preferences</a></p>
    </div>
  </div>
</body>
</html>`;
}
