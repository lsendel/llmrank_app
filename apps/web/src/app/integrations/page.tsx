import Link from "next/link";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const INTEGRATIONS = [
  {
    name: "Google Search Console",
    description:
      "Connect GSC to analyze actual search performance data alongside LLM readiness scores.",
    features: [
      "Import search analytics",
      "Correlate rankings with AI scores",
      "Identify high-opportunity keywords",
    ],
    status: "Available",
  },
  {
    name: "Google Analytics 4",
    description:
      "Link GA4 to track how AI-driven traffic converts on your site.",
    features: [
      "Track AI referral traffic",
      "Measure engagement metrics",
      "Conversion attribution",
    ],
    status: "Available",
  },
  {
    name: "WordPress Plugin",
    description:
      "Automatically optimize your content for AI search directly from your WP editor.",
    features: [
      "Real-time content scoring",
      "Schema markup generation",
      "Robots.txt management",
    ],
    status: "Coming Soon",
  },
  {
    name: "Slack",
    description:
      "Get notified when your AI visibility score changes or when you're cited by an LLM.",
    features: [
      "Real-time alerts",
      "Weekly summary reports",
      "Team collaboration",
    ],
    status: "Coming Soon",
  },
];

export default function IntegrationsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-primary"
          >
            LLM Boost
          </Link>
          <Link
            href="/sign-in"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Integrations
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Supercharge your AI SEO strategy by connecting LLM Boost with your
            favorite tools.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {INTEGRATIONS.map((integration) => (
            <Card key={integration.name} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">{integration.name}</CardTitle>
                  {integration.status === "Available" ? (
                    <span className="inline-flex items-center rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                      Available
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      Coming Soon
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <p className="mb-4 text-muted-foreground">
                  {integration.description}
                </p>
                <ul className="mb-6 flex-1 space-y-2">
                  {integration.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm"
                    >
                      <CheckCircle className="mt-0.5 h-4 w-4 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={
                    integration.status === "Available" ? "default" : "outline"
                  }
                  disabled={integration.status !== "Available"}
                  className="w-full"
                >
                  {integration.status === "Available" ? "Connect" : "Notify Me"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <footer className="mt-auto border-t border-border py-8">
        <div className="mx-auto text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} LLM Boost
        </div>
      </footer>
    </div>
  );
}
