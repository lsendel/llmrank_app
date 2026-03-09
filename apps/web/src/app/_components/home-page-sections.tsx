import Link from "next/link";
import { CheckCircle2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut } from "@/lib/auth-hooks";
import {
  HOME_PAGE_B2B_TEAMS,
  HOME_PAGE_FACTORS,
  HOME_PAGE_FAQ_ITEMS,
  HOME_PAGE_NAV_LINKS,
  HOME_PAGE_PLATFORM_LINKS,
  HOME_PAGE_PROBLEM_BULLETS,
  HOME_PAGE_RESOURCE_LINKS,
  HOME_PAGE_STATS,
  HOME_PAGE_STEPS,
} from "../home-page-helpers";

export function HomePageLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="fixed top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-xl tracking-tight text-foreground"
          >
            <Zap className="h-5 w-5 text-primary fill-current" />
            LLM Rank
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {HOME_PAGE_NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-muted-foreground hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <SignedOut>
              <Link
                href="/sign-in"
                className="hidden sm:block text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Sign in
              </Link>
              <Link href="/scan">
                <Button size="sm">Get Started</Button>
              </Link>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard">
                <Button size="sm">Dashboard</Button>
              </Link>
            </SignedIn>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-16">
        <section className="relative overflow-hidden px-6 py-24 sm:py-32 lg:pb-40">
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary mb-8">
              <span className="flex h-2 w-2 rounded-full bg-primary mr-2"></span>
              The AI Search Optimization Platform
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl md:text-7xl leading-tight">
              Rank in{" "}
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-primary bg-clip-text text-transparent">
                ChatGPT, Claude
              </span>{" "}
              <br className="hidden sm:block" />
              &amp; Perplexity
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              LLM Rank analyzes your website across{" "}
              <strong>37 AI ranking factors</strong> and shows you exactly how
              to improve visibility in AI-powered search engines.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/scan" className="w-full sm:w-auto">
                <Button
                  size="xl"
                  className="w-full h-14 px-8 text-lg shadow-xl shadow-primary/20"
                >
                  Run Free AI Audit
                </Button>
              </Link>
              <Link href="/ai-seo-tool" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="xl"
                  className="w-full h-14 px-8 text-lg"
                >
                  See Sample Report
                </Button>
              </Link>
            </div>

            <p className="mt-6 text-sm text-muted-foreground">
              No credit card required. Analyzes Technical SEO, Content Depth
              &amp; AI Readiness.
            </p>
          </div>
        </section>

        <section className="bg-muted/50 py-24 px-6 border-y border-border">
          <div className="mx-auto max-w-7xl">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-6">
                  Traditional SEO optimizes for Google. <br />
                  <span className="text-primary">
                    AI search uses different signals.
                  </span>
                </h2>
                <div className="space-y-6">
                  <p className="text-lg text-muted-foreground">
                    Google ranks links. AI models synthesize answers. If your
                    content isn&apos;t citation-ready, you get ignored by the
                    algorithms powering the future of search.
                  </p>
                  <ul className="space-y-3">
                    {HOME_PAGE_PROBLEM_BULLETS.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <CheckCircle2 className="h-6 w-6 text-red-500 shrink-0" />
                        <span className="text-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="relative rounded-2xl border border-border bg-background p-8 shadow-2xl">
                <div className="absolute -top-4 -right-4 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-bold shadow-lg">
                  The Shift
                </div>
                <div className="space-y-6">
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                      Old Way (Google)
                    </div>
                    <div className="h-4 w-3/4 bg-muted-foreground/20 rounded mb-2"></div>
                    <div className="h-4 w-1/2 bg-muted-foreground/20 rounded"></div>
                    <div className="mt-4 flex gap-2">
                      <div className="h-20 w-full bg-blue-500/10 rounded border border-blue-500/20 flex items-center justify-center text-blue-500 text-xs font-medium">
                        Blue Link 1
                      </div>
                      <div className="h-20 w-full bg-blue-500/10 rounded border border-blue-500/20 flex items-center justify-center text-blue-500 text-xs font-medium">
                        Blue Link 2
                      </div>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="text-xs font-semibold text-primary uppercase mb-2">
                      New Way (AI Search)
                    </div>
                    <div className="p-4 bg-background rounded border border-border shadow-sm">
                      <p className="text-sm text-foreground italic">
                        &quot;According to [Your Brand], the best practice
                        for...&quot;
                      </p>
                    </div>
                    <div className="mt-2 text-xs text-center text-muted-foreground">
                      Direct Citation &amp; Answer Synthesis
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 px-6 overflow-hidden">
          <div className="mx-auto max-w-7xl">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                The 37 AI Ranking Factors
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                We reverse-engineered how Large Language Models evaluate trust
                and authority.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {HOME_PAGE_FACTORS.map((factor) => (
                <div
                  key={factor.name}
                  className="relative group overflow-hidden rounded-xl border border-border bg-background p-6 hover:shadow-lg transition-all"
                >
                  <div
                    className={`absolute top-0 left-0 w-1 h-full ${factor.color.replace("text", "bg")}`}
                  ></div>
                  <h3 className={`text-xl font-bold ${factor.color}`}>
                    {factor.weight}
                  </h3>
                  <div className="text-lg font-semibold text-foreground mt-2">
                    {factor.name}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {factor.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-primary/5 py-24 px-6">
          <div className="mx-auto max-w-7xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-foreground">
                How It Works
              </h2>
              <p className="mt-4 text-muted-foreground">
                From invisible to cited in three steps.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {HOME_PAGE_STEPS.map((item) => (
                <div
                  key={item.step}
                  className="bg-background rounded-xl p-8 shadow-sm border border-border relative"
                >
                  <div className="absolute -top-6 left-8 bg-primary text-primary-foreground text-xl font-bold w-12 h-12 rounded-xl flex items-center justify-center shadow-lg">
                    {item.step}
                  </div>
                  <h3 className="mt-6 text-xl font-bold text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 px-6">
          <div className="mx-auto max-w-7xl">
            <h2 className="text-3xl font-bold text-center mb-16">
              Built for B2B Growth Teams
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {HOME_PAGE_B2B_TEAMS.map((team) => (
                <div
                  key={team.title}
                  className="flex flex-col items-center text-center p-6 rounded-xl hover:bg-muted/50 transition-colors"
                >
                  <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                    <team.icon className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">
                    {team.title}
                  </h3>
                  <p className="mt-2 text-muted-foreground">
                    {team.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 px-6 bg-slate-950 text-white">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-3xl sm:text-4xl font-bold mb-8">
              Why AI Search Optimization Matters
            </h2>
            <div className="grid sm:grid-cols-3 gap-8 text-center">
              {HOME_PAGE_STATS.map((item) => (
                <div key={item.value + item.description}>
                  <div
                    className={`text-5xl font-bold mb-2 ${item.valueClassName}`}
                  >
                    {item.value}
                  </div>
                  <p className={item.descriptionClassName}>
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 px-6 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            {HOME_PAGE_FAQ_ITEMS.map((item) => (
              <details
                key={item.question}
                className="group border border-border rounded-lg bg-background p-6 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-1.5 font-bold text-lg text-foreground">
                  {item.question}
                  <span className="shrink-0 transition duration-300 group-open:-rotate-180">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                </summary>
                <p className="mt-4 leading-relaxed text-muted-foreground">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section className="py-24 px-6 text-center border-t border-border">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl font-bold mb-6">
              Ready to rank in the AI Era?
            </h2>
            <p className="text-xl text-muted-foreground mb-10">
              Join 5,000+ marketers optimizing for ChatGPT &amp; Perplexity.
            </p>
            <Link href="/scan">
              <Button size="xl" className="h-16 px-10 text-xl">
                Get Your AI Score
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-12 bg-muted/20">
        <div className="mx-auto max-w-7xl px-6 grid md:grid-cols-4 gap-8 text-sm">
          <div className="col-span-1 md:col-span-2">
            <span className="font-bold text-lg flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4" /> LLM Rank
            </span>
            <p className="text-muted-foreground max-w-xs">
              The first B2B platform for AI Search Optimization (AISO). Helping
              brands become the cited source for the world&apos;s knowledge
              models.
            </p>
          </div>
          <div>
            <h3 className="font-bold mb-4">Platform</h3>
            <ul className="space-y-3 text-muted-foreground">
              {HOME_PAGE_PLATFORM_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-bold mb-4">Resources</h3>
            <ul className="space-y-3 text-muted-foreground">
              {HOME_PAGE_RESOURCE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-6 mt-12 pt-8 border-t border-border text-center text-muted-foreground">
          &copy; {new Date().getFullYear()} LLM Rank. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
