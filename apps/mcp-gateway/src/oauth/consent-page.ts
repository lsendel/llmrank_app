/**
 * OAuth consent page HTML template.
 *
 * Renders a login + consent form that POSTs back to /oauth/authorize.
 * OAuth params are embedded as hidden fields so the gateway can
 * complete the flow in a single stateless request.
 */

interface ConsentPageParams {
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  error?: string;
  email?: string;
}

const SCOPE_LABELS: Record<string, string> = {
  "projects:read": "View your projects",
  "projects:write": "Create and update projects",
  "crawls:read": "View crawl results",
  "crawls:write": "Start new crawls",
  "pages:read": "View page data",
  "scores:read": "View SEO scores",
  "issues:read": "View detected issues",
  "visibility:read": "View AI visibility checks",
  "visibility:write": "Run AI visibility checks",
  "fixes:write": "Generate fix suggestions",
  "strategy:read": "View strategy recommendations",
  "competitors:read": "View competitor data",
  "keywords:write": "Suggest keywords",
  "queries:write": "Suggest queries",
  "reports:write": "Generate reports",
  "content:read": "View content analysis",
  "technical:read": "View technical analysis",
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderConsentPage(params: ConsentPageParams): string {
  const scopes = params.scope.split(" ").filter(Boolean);
  const scopeList = scopes
    .map((s) => {
      const label = SCOPE_LABELS[s] || s;
      return `<li>${escapeHtml(label)}</li>`;
    })
    .join("\n            ");

  const errorHtml = params.error
    ? `<div class="error">${escapeHtml(params.error)}</div>`
    : "";

  const emailValue = params.email ? escapeHtml(params.email) : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Authorize — LLM Boost</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0a0a0f;
      color: #e4e4e7;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .card {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      width: 100%;
      max-width: 420px;
      padding: 2rem;
    }
    .logo {
      text-align: center;
      margin-bottom: 1.5rem;
    }
    .logo h1 {
      font-size: 1.25rem;
      font-weight: 600;
      color: #f4f4f5;
    }
    .logo p {
      font-size: 0.85rem;
      color: #71717a;
      margin-top: 0.25rem;
    }
    .divider {
      border: none;
      border-top: 1px solid #27272a;
      margin: 1.25rem 0;
    }
    .scopes-section h2 {
      font-size: 0.875rem;
      font-weight: 500;
      color: #a1a1aa;
      margin-bottom: 0.75rem;
    }
    .scopes-section ul {
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .scopes-section li {
      font-size: 0.8rem;
      background: #27272a;
      color: #d4d4d8;
      padding: 0.3rem 0.6rem;
      border-radius: 6px;
    }
    .client-info {
      font-size: 0.8rem;
      color: #71717a;
      margin-bottom: 0.25rem;
    }
    label {
      display: block;
      font-size: 0.85rem;
      font-weight: 500;
      color: #a1a1aa;
      margin-bottom: 0.35rem;
    }
    input[type="email"], input[type="password"] {
      width: 100%;
      padding: 0.6rem 0.75rem;
      border: 1px solid #3f3f46;
      border-radius: 8px;
      background: #09090b;
      color: #f4f4f5;
      font-size: 0.9rem;
      outline: none;
      transition: border-color 0.15s;
    }
    input:focus {
      border-color: #6366f1;
    }
    .field { margin-bottom: 1rem; }
    .error {
      background: #451a1a;
      border: 1px solid #7f1d1d;
      color: #fca5a5;
      padding: 0.6rem 0.75rem;
      border-radius: 8px;
      font-size: 0.85rem;
      margin-bottom: 1rem;
    }
    .btn {
      width: 100%;
      padding: 0.65rem;
      border: none;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .btn:hover { opacity: 0.9; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary {
      background: #6366f1;
      color: white;
    }
    .btn-secondary {
      background: transparent;
      color: #a1a1aa;
      border: 1px solid #3f3f46;
      margin-top: 0.5rem;
    }
    .footer {
      text-align: center;
      margin-top: 1.25rem;
      font-size: 0.75rem;
      color: #52525b;
    }
    .footer a { color: #6366f1; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <h1>LLM Boost</h1>
      <p>AI-Readiness SEO Platform</p>
    </div>

    <p class="client-info">
      <strong>${escapeHtml(params.clientId)}</strong> wants to access your account
    </p>

    <div class="scopes-section">
      <h2>Permissions requested</h2>
      <ul>
        ${scopeList}
      </ul>
    </div>

    <hr class="divider" />

    ${errorHtml}

    <form method="POST" action="/oauth/authorize" id="consent-form">
      <input type="hidden" name="client_id" value="${escapeHtml(params.clientId)}" />
      <input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirectUri)}" />
      <input type="hidden" name="scope" value="${escapeHtml(params.scope)}" />
      <input type="hidden" name="state" value="${escapeHtml(params.state)}" />
      <input type="hidden" name="code_challenge" value="${escapeHtml(params.codeChallenge)}" />
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(params.codeChallengeMethod)}" />
      <input type="hidden" name="response_type" value="code" />

      <div class="field">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" required autocomplete="email" value="${emailValue}" />
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required autocomplete="current-password" />
      </div>

      <button type="submit" class="btn btn-primary" id="submit-btn">Sign in &amp; Authorize</button>
      <button type="button" class="btn btn-secondary" onclick="handleDeny()">Deny</button>
    </form>

    <div class="footer">
      <p>By authorizing, you agree to the <a href="https://llmrank.app/terms" target="_blank">Terms of Service</a></p>
    </div>
  </div>

  <script>
    document.getElementById("consent-form").addEventListener("submit", function() {
      var btn = document.getElementById("submit-btn");
      btn.disabled = true;
      btn.textContent = "Signing in…";
    });

    function handleDeny() {
      var redirectUri = document.querySelector('input[name="redirect_uri"]').value;
      var state = document.querySelector('input[name="state"]').value;
      var url = new URL(redirectUri);
      url.searchParams.set("error", "access_denied");
      url.searchParams.set("error_description", "The user denied the request");
      if (state) url.searchParams.set("state", state);
      window.location.href = url.toString();
    }
  </script>
</body>
</html>`;
}
