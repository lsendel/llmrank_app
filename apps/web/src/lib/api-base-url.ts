const LOCAL_API_URL = "http://localhost:8787";

function sanitizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function isPrivateIpv4(hostname: string): boolean {
  const match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return false;

  const octets = match.slice(1).map((part) => Number(part));
  const [a, b] = octets;

  if (octets.some((value) => Number.isNaN(value) || value < 0 || value > 255)) {
    return false;
  }

  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized === "host.docker.internal" ||
    normalized === "0.0.0.0" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    isPrivateIpv4(normalized)
  );
}

interface ResolveApiBaseUrlOptions {
  configuredBaseUrl?: string | null;
  hostname?: string | null;
  isServer?: boolean;
  nodeEnv?: string | null;
}

export function resolveApiBaseUrl(
  options: ResolveApiBaseUrlOptions = {},
): string {
  const configured = options.configuredBaseUrl?.trim();
  if (configured) return sanitizeBaseUrl(configured);

  const nodeEnv = options.nodeEnv?.trim().toLowerCase();
  const allowServerLocalFallback = !nodeEnv || nodeEnv !== "production";

  if (options.isServer) {
    return allowServerLocalFallback ? LOCAL_API_URL : "";
  }
  if (options.hostname && isLocalHostname(options.hostname)) {
    return LOCAL_API_URL;
  }
  return "";
}

export function getApiBaseUrl(): string {
  return resolveApiBaseUrl({
    configuredBaseUrl: process.env.NEXT_PUBLIC_API_URL,
    hostname: typeof window === "undefined" ? null : window.location.hostname,
    isServer: typeof window === "undefined",
    nodeEnv: process.env.NODE_ENV,
  });
}

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = getApiBaseUrl();
  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}
