"use client";

import { useState } from "react";
import { Shield, ExternalLink, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

async function orgFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

interface SsoConfigurationProps {
  orgId: string;
  ssoEnabled?: boolean;
  ssoProvider?: string | null;
}

export function SsoConfiguration({
  orgId,
  ssoEnabled = false,
  ssoProvider = null,
}: SsoConfigurationProps) {
  const [provider, setProvider] = useState(ssoProvider ?? "saml");
  const [metadataUrl, setMetadataUrl] = useState("");
  const [entityId, setEntityId] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await orgFetch(`/api/orgs/${orgId}/sso/configure`, {
        method: "POST",
        body: JSON.stringify({
          provider,
          metadataUrl,
          entityId,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Failed to save SSO configuration");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setError(null);
    try {
      await orgFetch(`/api/orgs/${orgId}/sso/test`, { method: "POST" });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("SSO test connection failed. Check your configuration.");
    } finally {
      setTesting(false);
    }
  }

  async function handleDisable() {
    try {
      await orgFetch(`/api/orgs/${orgId}/sso`, { method: "DELETE" });
      window.location.reload();
    } catch {
      setError("Failed to disable SSO");
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Single Sign-On (SSO)
            </CardTitle>
            <CardDescription className="mt-1">
              Configure SAML or OIDC authentication for your organization.
            </CardDescription>
          </div>
          {ssoEnabled && (
            <Badge variant="default" className="bg-green-600">
              Active
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {saved && (
          <div className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950/50 dark:text-green-300">
            <CheckCircle2 className="h-4 w-4" />
            Configuration saved successfully
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Provider Type</label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="saml">SAML 2.0</SelectItem>
                <SelectItem value="oidc">OpenID Connect</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              {provider === "saml"
                ? "IdP Metadata URL"
                : "Discovery Endpoint URL"}
            </label>
            <Input
              placeholder={
                provider === "saml"
                  ? "https://your-idp.com/metadata.xml"
                  : "https://your-idp.com/.well-known/openid-configuration"
              }
              value={metadataUrl}
              onChange={(e) => setMetadataUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {provider === "saml"
                ? "The URL where your Identity Provider publishes its SAML metadata."
                : "The OpenID Connect discovery endpoint URL."}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              {provider === "saml" ? "SP Entity ID" : "Client ID"}
            </label>
            <Input
              placeholder={
                provider === "saml"
                  ? "https://llmboost.com/saml/metadata"
                  : "your-client-id"
              }
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
            />
          </div>

          {provider === "saml" && (
            <div className="rounded-md border bg-muted/30 p-4">
              <h4 className="text-sm font-medium">Service Provider Metadata</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Provide this URL to your IdP for SP-initiated login:
              </p>
              <code className="mt-2 block rounded bg-muted px-2 py-1 text-xs">
                {API_BASE}/api/orgs/{orgId}/sso/metadata
              </code>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 border-t pt-4">
          <Button onClick={handleSave} disabled={saving || !metadataUrl}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Configuration
          </Button>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing || !ssoEnabled}
          >
            {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Test Connection
          </Button>
          {ssoEnabled && (
            <Button variant="destructive" size="sm" onClick={handleDisable}>
              Disable SSO
            </Button>
          )}
          <a
            href="https://docs.llmboost.com/sso"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            SSO Docs
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
