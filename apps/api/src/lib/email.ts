/** Minimal email sending via Resend API (or any transactional email provider). */

import { createLogger } from "./logger";

const log = createLogger({ service: "email" });

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(
  apiKey: string,
  options: SendEmailOptions,
): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "LLM Boost <noreply@llmboost.app>",
      to: options.to,
      subject: options.subject,
      html: options.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    log.error("Email send failed", {
      status: res.status,
      to: options.to,
      response: body,
    });
  }
}

export function crawlCompleteEmail(
  projectName: string,
  overallScore: number,
  grade: string,
  dashboardUrl: string,
): string {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #1a1a2e;">Crawl Complete</h1>
      <p>Your crawl for <strong>${projectName}</strong> has finished.</p>
      <div style="background: #f8f9fa; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
        <div style="font-size: 48px; font-weight: bold; color: ${overallScore >= 80 ? "#22c55e" : overallScore >= 60 ? "#eab308" : "#ef4444"};">
          ${grade}
        </div>
        <div style="font-size: 24px; color: #666; margin-top: 8px;">
          ${overallScore}/100
        </div>
      </div>
      <a href="${dashboardUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        View Full Report
      </a>
    </div>
  `;
}

export function scoreDropEmail(
  projectName: string,
  previousScore: number,
  currentScore: number,
  dashboardUrl: string,
): string {
  const drop = previousScore - currentScore;
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #1a1a2e;">Score Alert</h1>
      <p>Your AI readiness score for <strong>${projectName}</strong> dropped by ${drop} points.</p>
      <div style="background: #fef2f2; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
        <div style="font-size: 24px; color: #666;">
          ${previousScore} → <span style="color: #ef4444; font-weight: bold;">${currentScore}</span>
        </div>
      </div>
      <a href="${dashboardUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        View Details
      </a>
    </div>
  `;
}
