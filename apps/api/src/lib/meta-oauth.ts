/**
 * Meta (Facebook) OAuth2 helpers for Graph API and Marketing API integrations.
 */

const META_AUTH_URL = "https://www.facebook.com/v21.0/dialog/oauth";
const META_TOKEN_URL = "https://graph.facebook.com/v21.0/oauth/access_token";

export const META_SCOPES = {
  basic: "pages_show_list,pages_read_engagement,email",
  ads: "ads_read",
} as const;

export function buildMetaAuthUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: string[];
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: opts.scopes.join(","),
    state: opts.state,
  });
  return `${META_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(opts: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    redirect_uri: opts.redirectUri,
    code: opts.code,
  });

  const res = await fetch(`${META_TOKEN_URL}?${params.toString()}`);

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Meta token exchange failed: ${err}`);
  }

  const data: {
    access_token: string;
    token_type: string;
    expires_in: number;
  } = await res.json();

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

export async function exchangeForLongLivedToken(opts: {
  shortLivedToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    fb_exchange_token: opts.shortLivedToken,
  });

  const res = await fetch(`${META_TOKEN_URL}?${params.toString()}`);

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Meta long-lived token exchange failed: ${err}`);
  }

  const data: {
    access_token: string;
    token_type: string;
    expires_in: number;
  } = await res.json();

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

export async function refreshLongLivedToken(opts: {
  token: string;
  clientId: string;
  clientSecret: string;
}): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  // Meta long-lived tokens are refreshed by exchanging again via fb_exchange_token
  return exchangeForLongLivedToken({
    shortLivedToken: opts.token,
    clientId: opts.clientId,
    clientSecret: opts.clientSecret,
  });
}
