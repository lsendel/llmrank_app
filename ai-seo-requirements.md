# AI-Readiness SEO Platform — Complete Requirements Document

**Product:** LLM Boost (AI-Readiness SEO Platform)
**Owner:** Lsendel
**Status:** Draft
**Version:** 2.0
**Last Updated:** February 13, 2026
**Stack:** Next.js + Cloudflare Workers + D1 + R2 + Rust Crawler + Hetzner

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement & Opportunity](#2-problem-statement--opportunity)
3. [User Personas & Research](#3-user-personas--research)
4. [User Journey Maps](#4-user-journey-maps)
5. [User Stories & Acceptance Criteria](#5-user-stories--acceptance-criteria)
6. [Functional Requirements](#6-functional-requirements)
7. [Scoring Engine Specification](#7-scoring-engine-specification)
8. [Technical Architecture](#8-technical-architecture)
9. [Repository Structure](#9-repository-structure)
10. [Database Schema](#10-database-schema)
11. [API Contracts](#11-api-contracts)
12. [Rust Crawler Implementation](#12-rust-crawler-implementation)
13. [LLM Integration Strategy](#13-llm-integration-strategy)
14. [User Experience Requirements](#14-user-experience-requirements)
15. [Non-Functional Requirements](#15-non-functional-requirements)
16. [Success Metrics & Analytics](#16-success-metrics--analytics)
17. [MVP Feature Prioritization](#17-mvp-feature-prioritization)
18. [90-Day Sprint Plan](#18-90-day-sprint-plan)
19. [Testing Strategy](#19-testing-strategy)
20. [Launch Criteria](#20-launch-criteria)
21. [Cost Optimization](#21-cost-optimization)
22. [Deployment & CI/CD](#22-deployment--cicd)
23. [Risk Assessment & Mitigation](#23-risk-assessment--mitigation)
24. [Post-Launch Iteration Plan](#24-post-launch-iteration-plan)
25. [Appendices](#25-appendices)

---

## 1. Executive Summary

### 1.1 Product Vision

LLM Boost is the actionable AI SEO platform that helps digital agencies and freelance marketers optimize their content for AI search engines like ChatGPT, Claude, Perplexity, and Gemini. Unlike traditional SEO tools adding GEO as an afterthought, LLM Boost combines deep technical crawling, AI-powered content evaluation, and real-time visibility tracking to show users exactly how to get cited by AI assistants.

**One-sentence description:** LLM Boost crawls your website, scores every page for AI-readiness across 30+ factors, and gives you prioritized, actionable recommendations to increase your visibility in AI-generated responses.

### 1.2 Key Differentiator

"The Actionable AI SEO Platform" — while competitors show _what_ is wrong, LLM Boost shows _how_ to fix it with specific, implementable recommendations that agencies can execute immediately for their clients.

### 1.3 Target Users

- **Primary:** Digital agencies managing SEO for multiple clients ($149–$299/mo)
- **Secondary:** Freelance SEO consultants and in-house content leads ($79/mo)
- **Tertiary:** Solo marketers and content creators (free tier → $79/mo)

### 1.4 Success Definition

| Metric                          | 6-Month Target | 12-Month Target |
| ------------------------------- | -------------- | --------------- |
| Monthly Recurring Revenue (MRR) | $15K           | $50K            |
| Paying Customers                | 150            | 500             |
| Free-to-Paid Conversion Rate    | 8%             | 12%             |
| Monthly Churn Rate              | < 8%           | < 5%            |
| Pages Scored Per Month          | 500K           | 2M              |
| NPS Score                       | 40+            | 50+             |

### 1.5 Strategic Alignment

| Business Objective        | How This Product Supports It                                        |
| ------------------------- | ------------------------------------------------------------------- |
| Revenue Growth to $5M ARR | SaaS subscriptions at $79–$299/mo with strong upsell path           |
| Market Positioning        | First-mover in actionable GEO recommendations (not just monitoring) |
| Customer Retention        | Recurring crawls create ongoing dependency and habitual usage       |
| Competitive Moat          | Proprietary scoring engine + multi-LLM visibility tracking          |

### 1.6 Resource Requirements

| Resource                | Requirement                                           |
| ----------------------- | ----------------------------------------------------- |
| Development Timeline    | 20 weeks (5 months) to full platform                  |
| MVP Timeline            | 6 weeks to first usable technical audit               |
| Budget (Infrastructure) | ~$65/mo at launch, scaling to ~$460/mo at 1,000 users |
| Budget (LLM APIs)       | ~$50/mo at 100 users, ~$400/mo at 1,000 users         |
| Team                    | Solo founder with AI-assisted development tools       |

---

## 2. Problem Statement & Opportunity

### 2.1 Problem Definition

AI search engines (ChatGPT, Claude, Perplexity, Gemini) are rapidly replacing traditional search for information queries. Content creators, agencies, and marketers have no reliable way to understand whether their content will be cited by these AI systems, what factors influence AI citation decisions, or how to optimize for this new paradigm.

**Quantified Impact:**

- LLM-specific SEO searches are up 306% year-over-year
- 89.7% of marketers report using AI in social media marketing
- The AI-powered SEO market is growing from $1.99B (2024) to $4.97B (2033)
- Agencies report spending 3–5 hours per client per month on manual AI visibility checks
- Content teams waste 40–60% of optimization effort on factors that don't influence AI citation

**Evidence:**

- Reddit communities (r/SEO, r/bigseo) show daily threads about AI search optimization
- SEO conference talks on GEO have tripled from 2024 to 2025
- Semrush and Ahrefs have announced GEO features but position them as add-ons, not core
- Peec AI raised $29M validating market demand but focuses on monitoring over actionability

### 2.2 Opportunity Analysis

| Dimension                      | Assessment                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| Market Size                    | $1.99B (2024) → $4.97B (2033), 10.7% CAGR                                           |
| Target Segment                 | ~50,000 digital agencies + ~200,000 freelance SEO consultants globally              |
| Serviceable Addressable Market | ~$500M (agencies + freelancers needing GEO tools)                                   |
| Revenue Opportunity            | $5M ARR achievable with ~1,700 customers at $245 avg. revenue                       |
| Competitive Gap                | No platform combines crawling + AI scoring + visibility tracking + actionable fixes |
| Timing                         | Market awareness is high but tooling is immature — ideal entry window               |

### 2.3 Competitive Landscape

| Competitor     | Category             | GEO Approach                            | Key Weakness                                    |
| -------------- | -------------------- | --------------------------------------- | ----------------------------------------------- |
| Semrush        | Traditional SEO      | GEO as add-on module                    | Bolted-on, not core focus                       |
| Ahrefs         | Traditional SEO      | AI content grader beta                  | Limited to content scoring, no visibility       |
| Surfer SEO     | Content Optimization | AI as secondary feature                 | No multi-LLM tracking                           |
| Peec AI        | Purpose-built GEO    | Monitoring-focused                      | Shows "what" not "how" — $29M raised, €89–99/mo |
| Otterly.ai     | AI Visibility        | Brand mention tracking                  | No content optimization guidance                |
| LLM Boost (us) | Purpose-built GEO    | Full stack: crawl + score + track + fix | Differentiated by actionability                 |

---

## 3. User Personas & Research

### 3.1 Primary Persona: Agency Account Manager — "Sarah"

| Attribute            | Detail                                                   |
| -------------------- | -------------------------------------------------------- |
| **Role**             | SEO Account Manager at a 10-person digital agency        |
| **Age**              | 28–38                                                    |
| **Tech Savviness**   | High — comfortable with SEO tools, analytics platforms   |
| **Clients**          | Manages 8–15 client websites simultaneously              |
| **Budget Authority** | Can approve tools up to $300/mo without manager sign-off |
| **Current Tools**    | Semrush, Google Search Console, Screaming Frog, Ahrefs   |

**Goals:**

- Demonstrate measurable value to clients with clear before/after metrics
- Stay ahead of competitors by offering AI search optimization as a service
- Reduce time spent on manual audits to focus on strategy
- Generate professional reports for client presentations

**Pain Points:**

- Manually checking if clients appear in ChatGPT/Perplexity responses takes hours
- No single tool covers technical SEO + AI content readiness + visibility tracking
- Clients are asking about AI search optimization and she doesn't have good answers
- Existing tools show problems but don't explain what specifically to change

**Current Workflow:**

1. Run Screaming Frog crawl (30 min setup + crawl time)
2. Check Google Search Console for rankings (15 min)
3. Manually query ChatGPT/Perplexity for client topics (1–2 hours per client)
4. Compile findings in Google Sheets (30 min)
5. Write recommendations in Google Docs (1 hour)
6. Total: 3–5 hours per client per month

**Success Criteria:** Reduce audit time to 30 minutes per client, get actionable AI optimization recommendations, impress clients with professional AI readiness reports.

### 3.2 Secondary Persona: Freelance SEO Consultant — "Marcus"

| Attribute          | Detail                                                                         |
| ------------------ | ------------------------------------------------------------------------------ |
| **Role**           | Independent SEO consultant, solo operator                                      |
| **Age**            | 25–45                                                                          |
| **Tech Savviness** | Very high — technical SEO background                                           |
| **Clients**        | 3–8 clients, mostly small businesses                                           |
| **Budget**         | Price-sensitive, needs ROI justification for every tool                        |
| **Current Tools**  | Free/cheap tools: Google Search Console, free Semrush tier, PageSpeed Insights |

**Goals:**

- Differentiate from other freelancers by offering AI SEO services
- Get more done with less time (solo operator, no team)
- Build recurring revenue through monthly optimization retainers
- Learn what actually matters for AI search optimization

**Pain Points:**

- Can't afford $99+/mo enterprise tools for each client
- Spends unpaid time researching how AI search engines work
- Clients expect expertise in AI SEO but information is scattered
- No way to prove impact of optimizations to clients

**Success Criteria:** Affordable tool ($79/mo) that covers multiple clients, clear learning path for AI SEO, reports he can share with clients to justify his retainer.

### 3.3 Tertiary Persona: In-House Content Lead — "Priya"

| Attribute          | Detail                                                   |
| ------------------ | -------------------------------------------------------- |
| **Role**           | Content Marketing Manager at a B2B SaaS company          |
| **Age**            | 30–40                                                    |
| **Tech Savviness** | Moderate — knows content strategy, limited technical SEO |
| **Scope**          | One website, 200–500 pages of content                    |
| **Budget**         | Marketing budget covers tools if she can show ROI        |
| **Current Tools**  | WordPress, Google Analytics, Clearscope or MarketMuse    |

**Goals:**

- Ensure company blog content appears in AI assistant responses
- Prioritize which existing content to update for maximum AI visibility
- Report to VP Marketing on AI search performance

**Pain Points:**

- Doesn't understand the technical factors that influence AI citation
- Too many pages to optimize manually — needs prioritization help
- No baseline metrics for AI visibility to measure improvement against
- Content optimization tools focus on Google, not AI assistants

**Success Criteria:** Simple dashboard showing AI readiness scores, prioritized list of pages to fix, specific content recommendations she can hand to writers.

### 3.4 User Research Findings

| Finding                                                              | Source                      | Implication                                                  |
| -------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------ |
| 73% of agencies have been asked about AI SEO by clients              | Industry survey (2025)      | Strong demand signal — agencies need tools to answer this    |
| Average agency spends $200–400/mo on SEO tools per client            | Agency pricing research     | Our $149–299/mo pricing is within existing budget allocation |
| "Show me what to fix" is the #1 request in SEO tool reviews          | G2/Capterra review analysis | Actionability is the primary differentiator to build         |
| Technical SEO audits are table stakes; AI-specific analysis is novel | Competitor gap analysis     | Technical audit is the wedge, AI scoring is the moat         |
| White-label reports influence 40% of agency tool purchases           | Agency buyer research       | White-label must be in Phase 3 to capture agency segment     |

---

## 4. User Journey Maps

### 4.1 New User Journey: Discovery to Value

```
AWARENESS → SIGNUP → FIRST CRAWL → FIRST INSIGHT → REPEAT USAGE → UPGRADE → ADVOCACY

Stage 1: Awareness
├── Discovers LLM Boost via SEO community, search, or referral
├── Lands on marketing site with before/after optimization examples
└── Understands value proposition: "See how AI search engines view your content"

Stage 2: Signup (Target: < 60 seconds)
├── Creates account with email or Google OAuth
├── No credit card required for free tier
└── Sees empty dashboard with prominent "Add Your First Project" CTA

Stage 3: First Crawl (Target: < 3 minutes to initiate)
├── Enters domain URL
├── Platform validates domain and shows estimated crawl time
├── Crawl begins — real-time progress bar shows pages discovered/crawled
└── User receives email when crawl completes (if they navigate away)

Stage 4: First Insight (Target: "Aha!" in < 30 seconds after results)
├── Dashboard shows overall AI-readiness score (0-100) with letter grade
├── Top 5 critical issues displayed prominently with severity badges
├── Each issue has a specific recommendation with implementation steps
└── User clicks into a page detail view and understands what to fix

Stage 5: Repeat Usage
├── User fixes top recommendations and re-crawls to see improvement
├── Score increases create positive feedback loop
├── Historical comparison shows progress over time
└── User shares reports with team/clients

Stage 6: Upgrade (Target: 8-12% free-to-paid conversion)
├── User hits free tier limits (10 pages, 2 crawls, 1 project)
├── Upgrade prompt shows what they unlock (100+ pages, AI scoring, visibility)
├── Stripe checkout with immediate access to paid features
└── New capabilities (AI content scoring, visibility tracking) drive retention

Stage 7: Advocacy
├── User shares AI-readiness scores on social media
├── Agency creates white-label reports for clients
└── Referral program incentivizes word-of-mouth
```

### 4.2 Core Workflow: Run Audit & Act on Results

```
SUBMIT URL → CRAWL IN PROGRESS → REVIEW RESULTS → DRILL INTO ISSUES → IMPLEMENT FIXES → RE-CRAWL

1. Submit URL
   Input: Domain URL (e.g., "example.com")
   System: Validates URL, checks robots.txt, estimates pages
   Output: Crawl job created, progress view displayed

2. Crawl In Progress
   System: Rust crawler fetches pages, extracts data, runs Lighthouse
   Display: Real-time progress (pages found / crawled / scored)
   Duration: 2-10 minutes for 50-200 pages

3. Review Results
   Display: Site overview dashboard with:
   ├── Overall AI-readiness score (0-100, letter grade A-F)
   ├── Score breakdown: Technical | Content | AI Readiness | Performance
   ├── Issue summary: X critical, Y warnings, Z info
   ├── Top 5 priority fixes with estimated impact
   └── Page-by-page score list (sortable, filterable)

4. Drill Into Issues
   User clicks an issue → sees:
   ├── What the issue is (clear, jargon-free explanation)
   ├── Why it matters for AI search (impact on citation likelihood)
   ├── Where it occurs (specific pages and elements)
   ├── How to fix it (step-by-step implementation guide)
   └── Expected impact of fixing (score improvement estimate)

5. Implement Fixes
   User makes changes to their website based on recommendations
   (Platform does NOT make changes — it guides what to change)

6. Re-Crawl
   User triggers new crawl → sees score comparison
   ├── Before/after scores per category
   ├── Issues resolved vs. new issues found
   ├── Historical trend chart
   └── Celebration UI for improvements ("Score improved by 12 points!")
```

---

## 5. User Stories & Acceptance Criteria

### Epic 1: User Onboarding & Authentication

#### Story 1.1: Account Creation

**As a** new user visiting the platform,
**I want** to create an account with my email or Google login,
**So that** I can save my projects and access my crawl results.

**Acceptance Criteria:**

- **Given** a user on the signup page, **When** they enter a valid email and password (8+ chars, 1 uppercase, 1 number), **Then** an account is created and a verification email is sent.
- **Given** a user clicks "Sign up with Google," **When** they authorize the OAuth flow, **Then** an account is created with their Google profile info and they land on the dashboard.
- **Given** a user enters an email already registered, **When** they submit, **Then** they see "An account with this email already exists. Log in instead?" with a link.
- **Given** a user has not verified their email, **When** they try to start a crawl, **Then** they see a banner: "Please verify your email to start crawling."

**Estimation:** 8 hours (Clerk integration) or 16 hours (Lucia custom)

#### Story 1.2: First-Run Onboarding

**As a** newly signed-up user,
**I want** a brief guided setup that helps me add my first project,
**So that** I can get value from the platform immediately.

**Acceptance Criteria:**

- **Given** a new user logs in for the first time, **When** the dashboard loads, **Then** they see a 3-step onboarding flow: (1) "Enter your website URL," (2) "Choose crawl depth," (3) "Start crawl."
- **Given** a user completes onboarding, **When** the crawl starts, **Then** a progress view replaces the onboarding UI.
- **Given** a user clicks "Skip" during onboarding, **When** they dismiss it, **Then** they see the empty dashboard with a prominent "Add Project" button. The onboarding does not reappear.

**Estimation:** 6 hours

#### Story 1.3: User Settings & Profile

**As a** registered user,
**I want** to manage my account settings (name, email, password, plan),
**So that** I can keep my information current and manage my subscription.

**Acceptance Criteria:**

- **Given** a user on the Settings page, **When** they update their name and save, **Then** the change is reflected across the dashboard immediately.
- **Given** a user wants to change their password, **When** they enter current password + new password, **Then** the password is updated and a confirmation email is sent.
- **Given** a user on the Billing tab, **When** they view their current plan, **Then** they see plan name, next billing date, usage against limits, and an "Upgrade" button.

**Estimation:** 4 hours

---

### Epic 2: Project Management

#### Story 2.1: Create Project

**As a** user with available project slots,
**I want** to create a project by entering a domain name,
**So that** I can start monitoring a website's AI-readiness.

**Acceptance Criteria:**

- **Given** a user clicks "New Project," **When** they enter a valid domain (e.g., "example.com") and a project name, **Then** a project is created and they see the project dashboard.
- **Given** a user enters a domain without a protocol, **When** they submit, **Then** the system auto-prepends "https://" and validates reachability.
- **Given** a user on the free plan already has 1 project, **When** they try to create another, **Then** they see an upgrade prompt: "Free plan includes 1 project. Upgrade to Starter for up to 5 projects."
- **Given** a user enters an unreachable domain, **When** the system validates, **Then** they see "We couldn't reach this domain. Please check the URL and try again."

**Estimation:** 4 hours

#### Story 2.2: Project Settings

**As a** project owner,
**I want** to configure crawl settings (max pages, depth, schedule),
**So that** I can tailor the crawl to my website's needs and plan limits.

**Acceptance Criteria:**

- **Given** a user on project settings, **When** they set max pages to 50 and depth to 3, **Then** these settings are saved and applied to the next crawl.
- **Given** a user on the free plan tries to set depth > 2, **When** they adjust the slider, **Then** it stops at 2 with a tooltip: "Upgrade for deeper crawls (up to depth 10)."
- **Given** a pro user enables scheduled crawls, **When** they select "Weekly" on Monday, **Then** the system creates a Cron Trigger and confirms the next crawl date.

**Estimation:** 4 hours

#### Story 2.3: Project List & Overview

**As a** user with multiple projects,
**I want** to see all my projects in a dashboard view with latest scores,
**So that** I can quickly identify which sites need attention.

**Acceptance Criteria:**

- **Given** a user with 5 projects, **When** they view the dashboard, **Then** they see a card for each project showing: domain, last crawl date, overall score (with trend arrow), and number of critical issues.
- **Given** a user clicks a project card, **When** the project loads, **Then** they see the full project dashboard with latest crawl results.
- **Given** no crawls have been run for a project, **When** the user views the card, **Then** it shows "No crawls yet" with a "Run First Crawl" button.

**Estimation:** 6 hours

---

### Epic 3: Site Crawling

#### Story 3.1: Initiate Crawl

**As a** project owner,
**I want** to start a crawl of my website,
**So that** the platform can analyze my pages for AI-readiness.

**Acceptance Criteria:**

- **Given** a user clicks "Start Crawl" on a project, **When** the system has available crawl credits, **Then** a crawl job is created (status: "pending"), a POST is sent to the Hetzner crawler, and the UI switches to a progress view.
- **Given** a user has 0 crawl credits remaining, **When** they click "Start Crawl," **Then** they see "You've used all your crawl credits this month. Upgrade or wait until [renewal date]."
- **Given** a crawl is already running for this project, **When** the user tries to start another, **Then** they see "A crawl is already in progress. Please wait for it to complete."

**Estimation:** 6 hours

#### Story 3.2: Crawl Progress

**As a** user who has started a crawl,
**I want** to see real-time progress of the crawl,
**So that** I know how long to wait and that the system is working.

**Acceptance Criteria:**

- **Given** a crawl is in progress, **When** the user views the crawl page, **Then** they see: a progress bar, pages found count, pages crawled count, pages scored count, elapsed time, and estimated time remaining.
- **Given** the crawler POSTs a batch result, **When** the Worker ingests it, **Then** the progress counts update within 5 seconds on the frontend (via polling or WebSocket).
- **Given** a crawl encounters an error on a specific page, **When** the batch is ingested, **Then** the errored page is recorded but the crawl continues. The error is visible in the crawl log.
- **Given** a crawl completes (is_final: true), **When** the user is on the progress page, **Then** the UI transitions to the results view automatically.

**Estimation:** 8 hours

#### Story 3.3: Cancel Crawl

**As a** user who started a crawl by mistake,
**I want** to cancel a running crawl,
**So that** I don't waste crawl credits.

**Acceptance Criteria:**

- **Given** a crawl is running, **When** the user clicks "Cancel Crawl" and confirms, **Then** a cancel request is sent to Hetzner, the job status changes to "cancelled," and partial results are preserved.
- **Given** a crawl is cancelled, **When** the user views the project, **Then** they see "Crawl cancelled — partial results (X of Y pages)" with options to "View Partial Results" or "Start New Crawl."

**Estimation:** 3 hours

---

### Epic 4: Technical SEO Audit

#### Story 4.1: Page-Level Technical Analysis

**As a** user viewing crawl results,
**I want** to see technical SEO metrics for each crawled page,
**So that** I can identify technical issues affecting AI discoverability.

**Acceptance Criteria:**

- **Given** a completed crawl, **When** the user views the page list, **Then** each page shows: URL, status code, title, overall score, technical score, and issue count.
- **Given** a page returned a 404 status, **When** the user views it, **Then** it shows a "Broken Page" badge and a recommendation to fix or redirect.
- **Given** a page has no meta description, **When** the scoring engine evaluates it, **Then** it creates an issue: code `MISSING_META_DESC`, severity "warning", category "technical", with recommendation "Add a meta description of 120-160 characters that summarizes this page's key topic."

**Estimation:** 8 hours

#### Story 4.2: Site-Level Technical Overview

**As a** user reviewing a crawl,
**I want** a site-level summary of technical health,
**So that** I can quickly understand the overall state and prioritize fixes.

**Acceptance Criteria:**

- **Given** a completed crawl of 50 pages, **When** the user views the site overview, **Then** they see: overall technical score (average), distribution chart (A/B/C/D/F), top 5 most common issues, and pages sorted by score (worst first).
- **Given** the site has 0 critical issues, **When** the overview loads, **Then** a success state is shown with suggestions for further optimization.

**Estimation:** 6 hours

#### Story 4.3: robots.txt & llms.txt Analysis

**As a** user concerned about AI crawler access,
**I want** to see whether my robots.txt and llms.txt files are properly configured,
**So that** I can ensure AI search engines can access and cite my content.

**Acceptance Criteria:**

- **Given** a site has no llms.txt file, **When** the crawl completes, **Then** an issue is created: code `MISSING_LLMS_TXT`, severity "critical", category "ai_readiness", recommendation "Create an llms.txt file at /llms.txt to explicitly permit AI crawlers and provide structured metadata about your site."
- **Given** a site's robots.txt blocks GPTBot, **When** the crawl analyzes it, **Then** an issue is created: code `AI_CRAWLER_BLOCKED`, severity "critical", recommendation "Remove the Disallow rule for GPTBot (and similar AI user agents) to allow AI search engines to index your content."
- **Given** a site has a well-configured llms.txt, **When** the analysis runs, **Then** a "pass" indicator is shown with the parsed contents displayed for review.

**Estimation:** 4 hours

#### Story 4.4: Schema Markup Analysis

**As a** user wanting to improve structured data,
**I want** to see which pages have schema markup and what types,
**So that** I can ensure AI engines can parse my content's entities.

**Acceptance Criteria:**

- **Given** a page has Organization and WebPage schema, **When** the results display, **Then** the detected schema types are listed with a completeness indicator.
- **Given** a page has no structured data, **When** the scoring engine runs, **Then** an issue is created: code `NO_STRUCTURED_DATA`, severity "warning", recommendation "Add JSON-LD structured data (at minimum: Organization, WebPage, and Article/FAQPage as appropriate)."
- **Given** a page has invalid JSON-LD, **When** the extractor processes it, **Then** an issue is created: code `INVALID_SCHEMA`, severity "warning", with the specific parse error in the data field.

**Estimation:** 4 hours

---

### Epic 5: AI Content Scoring (LLM-Powered)

#### Story 5.1: Content Quality Evaluation

**As a** user on a paid plan,
**I want** each page scored by an LLM for AI-readiness dimensions,
**So that** I understand how an AI would evaluate my content's quality.

**Acceptance Criteria:**

- **Given** a crawled page with 500+ words, **When** the LLM scoring engine processes it, **Then** it returns scores (0-100) for: Clarity, Authority, Comprehensiveness, Structure, and Citation Worthiness, plus an overall content score.
- **Given** a page with < 200 words, **When** the scoring engine encounters it, **Then** it skips LLM evaluation and flags issue `THIN_CONTENT` with severity "warning".
- **Given** two crawls where content_hash has not changed, **When** the second crawl runs scoring, **Then** the cached LLM score is reused (no new API call).
- **Given** a free-tier user, **When** scoring runs, **Then** only basic Haiku-level scoring is applied. A banner shows "Upgrade for detailed AI content analysis."

**Estimation:** 16 hours

#### Story 5.2: Content Recommendations

**As a** user viewing a page's content score,
**I want** specific, actionable recommendations for improving each dimension,
**So that** I (or my writers) can make targeted improvements.

**Acceptance Criteria:**

- **Given** a page scores 45/100 on Clarity, **When** the user views the detail, **Then** they see 2-3 specific recommendations (e.g., "Break the second section into 3 subsections with descriptive H2 headings").
- **Given** a page scores 90+/100 on all dimensions, **When** the user views it, **Then** they see a "High AI-readiness" badge with minor optimization suggestions.
- Recommendations use language appropriate for non-technical users.

**Estimation:** 8 hours (included in LLM prompt engineering)

---

### Epic 6: AI Visibility Tracking

#### Story 6.1: Visibility Check Setup

**As a** user who wants to track AI mentions,
**I want** to define queries that should trigger mentions of my brand/domain,
**So that** the platform can monitor whether AI assistants cite my content.

**Acceptance Criteria:**

- **Given** a user navigates to Visibility Tracking, **When** they click "Add Query," **Then** they can enter a search query and select which LLM providers to check (ChatGPT, Claude, Perplexity, Gemini, Copilot).
- **Given** a user has used all their visibility check quota, **When** they try to add a query, **Then** they see current usage and an upgrade prompt.
- **Given** a user on the Pro plan, **When** they set up a new query, **Then** they can also enter up to 5 competitor domains to track alongside their own.

**Estimation:** 6 hours

#### Story 6.2: Visibility Results Dashboard

**As a** user tracking AI visibility,
**I want** to see whether my brand/domain is mentioned across LLM responses,
**So that** I can measure my AI search presence and track improvement.

**Acceptance Criteria:**

- **Given** visibility checks have run, **When** the user views the Visibility dashboard, **Then** they see per-provider results: brand mentioned (yes/no), URL cited (yes/no), citation position, and competitor mentions.
- **Given** a query returns no brand mention, **When** the user views the result, **Then** the system suggests reviewing content recommendations for related pages.
- **Given** historical data exists, **When** the user views trends, **Then** they see a chart showing mention rate over time per provider.

**Estimation:** 10 hours

#### Story 6.3: Competitor Visibility Comparison

**As an** agency user managing client SEO,
**I want** to compare my client's AI visibility against competitors,
**So that** I can show clients where they stand and justify optimization work.

**Acceptance Criteria:**

- **Given** a user has configured 3 competitors, **When** visibility checks run, **Then** results show a comparison table: My Domain vs. Competitors for each query.
- **Given** a competitor is cited in position 1 and the user's domain is not cited, **When** the user views the detail, **Then** they see specific recommendations based on competitor content analysis.

**Estimation:** 8 hours

---

### Epic 7: Scoring & Recommendations Engine

#### Story 7.1: Overall Page Score Calculation

**As a** user viewing any page's results,
**I want** a single overall score (0-100) that reflects AI-readiness,
**So that** I can quickly assess page quality.

**Acceptance Criteria:**

- **Given** a crawled page with all data extracted, **When** the scoring engine runs, **Then** it produces: Overall score (weighted: Technical 25%, Content 30%, AI Readiness 30%, Performance 15%), Letter grade (A/B/C/D/F), and Sub-scores per category.
- **Given** a page with a 404 status code, **When** scored, **Then** it receives an overall score of 0 with issue `PAGE_NOT_FOUND`.

**Estimation:** 8 hours

#### Story 7.2: Issue Detection & Prioritization

**As a** user reviewing results,
**I want** issues sorted by priority (most impactful first),
**So that** I can fix the things that matter most first.

**Acceptance Criteria:**

- **Given** a crawl generates 47 issues, **When** the user views the issues list, **Then** issues are sorted: critical first, then warnings, then info. Within each severity, sorted by frequency (pages affected).
- **Given** an issue affects 15 of 50 pages, **When** displayed, **Then** it shows "Affects 15 pages" with a link to see all affected URLs.
- **Given** a user clicks an issue, **When** the detail view opens, **Then** they see: description, why it matters, affected pages, and step-by-step fix instructions.

**Estimation:** 6 hours

#### Story 7.3: Crawl Comparison

**As a** user who has run multiple crawls,
**I want** to compare scores between crawl runs,
**So that** I can see whether my optimizations are working.

**Acceptance Criteria:**

- **Given** a project has 2+ completed crawls, **When** the user opens "Compare," **Then** they see side-by-side scores with delta indicators color-coded green/red.
- **Given** a page's score improved by 10+ points, **When** displayed in comparison, **Then** it shows a celebration indicator.
- **Given** the first crawl just completed, **When** the user looks for comparison, **Then** they see "Run another crawl after making changes to see your progress."

**Estimation:** 8 hours

---

### Epic 8: Billing & Subscriptions

#### Story 8.1: Plan Selection & Checkout

**As a** free user hitting plan limits,
**I want** to upgrade to a paid plan via Stripe,
**So that** I can unlock more pages, projects, and features.

**Acceptance Criteria:**

- **Given** a user clicks "Upgrade," **When** the pricing page loads, **Then** they see all plans with feature comparison table.
- **Given** a user selects "Pro" and clicks "Subscribe," **When** Stripe Checkout opens, **Then** they can complete the purchase.
- **Given** Stripe confirms payment, **When** the webhook fires, **Then** the user's plan is updated in D1, credits set to new tier limits, and confirmation page shown.
- **Given** a Starter user upgrades to Pro, **When** they switch plans, **Then** Stripe prorates the charge and the user gets immediate access to Pro features.

**Estimation:** 8 hours

#### Story 8.2: Usage Metering & Limits

**As a** paying user,
**I want** to see my current usage against my plan limits,
**So that** I can manage my crawl credits and plan my work.

**Acceptance Criteria:**

- **Given** a Pro user has used 18 of 30 crawls this month, **When** they view billing, **Then** they see usage bars for: crawls, pages per crawl, projects, visibility checks.
- **Given** a user reaches 80% of any limit, **When** the dashboard loads, **Then** a non-intrusive banner warns of approaching limit.
- **Given** a user reaches 100% of crawl credits, **When** they try to start a crawl, **Then** the button is disabled with limit-reached message.

**Estimation:** 6 hours

#### Story 8.3: Subscription Management

**As a** paying customer,
**I want** to manage my subscription (upgrade, downgrade, cancel),
**So that** I can adjust my plan as my needs change.

**Acceptance Criteria:**

- **Given** a user clicks "Cancel Subscription," **When** the cancellation flow starts, **Then** they see a retention offer and a "reason for leaving" dropdown before confirming.
- **Given** a user confirms cancellation, **When** processed, **Then** they retain access until end of billing period, then revert to free plan. Data retained for 90 days.
- **Given** a user downgrades from Pro to Starter, **When** effective, **Then** projects beyond the Starter limit are set to read-only (not deleted).

**Estimation:** 6 hours

---

### Epic 9: Reporting & Export

#### Story 9.1: PDF Report Export

**As an** agency user,
**I want** to export a professional PDF report for a client,
**So that** I can present findings and justify my optimization work.

**Acceptance Criteria:**

- **Given** a completed crawl, **When** the user clicks "Export PDF," **Then** a PDF is generated with: executive summary, overall scores, top issues with recommendations, page-by-page scores, and trend charts.
- **Given** an Agency user with white-label enabled, **When** they export, **Then** the PDF uses their custom logo, colors, and company name.
- **Given** a large crawl (500+ pages), **When** PDF generation starts, **Then** user sees progress and receives an email when complete.

**Estimation:** 12 hours

---

## 6. Functional Requirements

### 6.1 Core Features (Must Have — Phase 1)

| Feature             | Description                                              | Business Logic                                                                                                                | Input                              | Output                                                 |
| ------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------ |
| URL Submission      | User enters domain to create project and initiate crawl  | Validate URL reachability, check crawl credits, create project + job in D1, POST to Hetzner                                   | Domain URL string                  | Project ID, Job ID, crawl progress view                |
| Multi-Page Crawling | Rust crawler traverses site following internal links     | BFS traversal respecting robots.txt, depth limits, page limits per tier. Rate limit 1 req/sec per domain                      | CrawlJobPayload JSON               | CrawlResultBatch posted back to CF                     |
| HTML Extraction     | Parse crawled pages for SEO-relevant elements            | Extract: title, meta desc, H1-H6, canonical, internal/external links, images without alt, schema markup, robots meta, OG tags | Raw HTML                           | ExtractedData JSON                                     |
| Lighthouse Audit    | Run Lighthouse on each page for performance + SEO scores | Shell out to Lighthouse CLI, capture JSON, limit to 2 concurrent audits                                                       | Page URL                           | Performance, SEO, Accessibility, Best Practices scores |
| Technical Scoring   | Score each page on 30+ technical SEO factors             | Apply scoring rules from Section 7                                                                                            | ExtractedData + Lighthouse results | PageScore with breakdown + Issues array                |
| Issue Detection     | Identify problems and generate recommendations           | Match scoring results against rule thresholds, create Issue records                                                           | PageScore data                     | Issues array per page                                  |
| Results Dashboard   | Display crawl results with scores and issues             | Fetch from D1, aggregate site-level stats, sort pages by score                                                                | Project/Job ID                     | Dashboard HTML with scores, issues, charts             |

### 6.2 Secondary Features (Must Have — Phase 2)

| Feature               | Description                                  | Business Logic                                                            |
| --------------------- | -------------------------------------------- | ------------------------------------------------------------------------- |
| LLM Content Scoring   | AI evaluation of content quality             | Send extracted text to LLM, cache by content_hash, apply tiered models    |
| Authentication        | User registration, login, session management | Clerk/Lucia integration, OAuth support, session tokens                    |
| Project Management    | CRUD for projects, multi-domain support      | Enforce plan limits on project count, validate domain uniqueness per user |
| Crawl History         | Historical crawl data with comparison        | Store all crawl results, compute deltas between runs                      |
| Issue Recommendations | Actionable fix instructions per issue        | Template-based recommendations with dynamic values                        |

### 6.3 Phase 3 Features (Must Have — Monetization)

| Feature                | Description                             | Business Logic                                                        |
| ---------------------- | --------------------------------------- | --------------------------------------------------------------------- |
| AI Visibility Tracking | Query LLMs and check for brand mentions | Multi-provider API calls, parse responses for domain/brand mentions   |
| Stripe Billing         | Subscription management with 4 tiers    | Webhooks for plan changes, credit allocation, proration               |
| Usage Metering         | Track and enforce plan limits           | Decrement credits per crawl, enforce page/depth limits, monthly reset |
| Scheduled Crawls       | Automatic recurring crawls              | Cron Triggers → Worker → POST to Hetzner                              |

### 6.4 Feature Prioritization (MoSCoW)

| Priority       | Features                                                                                 | Rationale                                          |
| -------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Must**       | Crawling, extraction, technical scoring, issue detection, basic dashboard, auth, billing | Core value proposition — without these, no product |
| **Should**     | LLM content scoring, visibility tracking, crawl comparison, scheduled crawls             | Key differentiators — these justify paid plans     |
| **Could**      | PDF export, competitor tracking, API, white-label, email notifications                   | Growth accelerators — drive agency adoption        |
| **Won't (v1)** | Chrome extension, WordPress plugin, Slack integration, AI rewriting, team management     | Future roadmap — validated by user demand first    |

---

## 7. Scoring Engine Specification

### 7.1 Score Categories & Weights

| Category        | Weight | Description                                               |
| --------------- | ------ | --------------------------------------------------------- |
| Technical SEO   | 25%    | Meta tags, links, status codes, crawlability              |
| Content Quality | 30%    | Depth, structure, readability, freshness                  |
| AI Readiness    | 30%    | Schema, llms.txt, citation-worthiness, structured answers |
| Performance     | 15%    | Lighthouse scores, Core Web Vitals                        |

### 7.2 Technical SEO Factors (13 factors)

| Code                | Factor               | Check                                               | Severity | Score Impact                 |
| ------------------- | -------------------- | --------------------------------------------------- | -------- | ---------------------------- |
| `MISSING_TITLE`     | Page title           | Title tag exists and is 30-60 chars                 | Critical | -15                          |
| `MISSING_META_DESC` | Meta description     | Meta description exists and is 120-160 chars        | Warning  | -10                          |
| `MISSING_H1`        | H1 heading           | Exactly one H1 tag present                          | Warning  | -8                           |
| `MULTIPLE_H1`       | Multiple H1s         | More than one H1 tag found                          | Warning  | -5                           |
| `HEADING_HIERARCHY` | Heading order        | H2 follows H1, H3 follows H2, no skipped levels     | Info     | -3                           |
| `BROKEN_LINKS`      | Internal link health | Internal links return 200 status                    | Warning  | -5 per broken link (max -20) |
| `MISSING_CANONICAL` | Canonical URL        | Canonical tag present and self-referencing or valid | Warning  | -8                           |
| `NOINDEX_SET`       | Robots meta          | Page is not set to noindex (unless intentional)     | Critical | -20                          |
| `MISSING_ALT_TEXT`  | Image alt attributes | All images have descriptive alt text                | Warning  | -3 per image (max -15)       |
| `HTTP_STATUS`       | HTTP status code     | Page returns 200 (non-redirect, non-error)          | Critical | -25 for 4xx/5xx              |
| `MISSING_OG_TAGS`   | Open Graph tags      | og:title, og:description, og:image present          | Info     | -5                           |
| `SLOW_RESPONSE`     | Server response time | Response time < 2 seconds                           | Warning  | -10                          |
| `MISSING_SITEMAP`   | Sitemap reference    | sitemap.xml exists and is valid                     | Info     | -5                           |

### 7.3 Content Quality Factors (9 factors)

| Code                    | Factor                  | Check                                                    | Severity | Score Impact                |
| ----------------------- | ----------------------- | -------------------------------------------------------- | -------- | --------------------------- |
| `THIN_CONTENT`          | Word count              | Page has 500+ words of substantive content               | Warning  | -15 if < 200, -8 if 200-499 |
| `CONTENT_DEPTH`         | Topic coverage          | LLM assessment of comprehensiveness (0-100)              | Varies   | Mapped to 0-20 point range  |
| `CONTENT_CLARITY`       | Readability & structure | LLM assessment of clarity (0-100)                        | Varies   | Mapped to 0-20 point range  |
| `CONTENT_AUTHORITY`     | Expertise signals       | LLM assessment: citations, data, expert language (0-100) | Varies   | Mapped to 0-20 point range  |
| `DUPLICATE_CONTENT`     | Content uniqueness      | content_hash compared across pages in same project       | Warning  | -15 for exact duplicate     |
| `STALE_CONTENT`         | Content freshness       | Last-modified or date indicators > 12 months old         | Info     | -5                          |
| `NO_INTERNAL_LINKS`     | Internal linking        | Page has 2+ internal links to relevant content           | Warning  | -8                          |
| `EXCESSIVE_LINKS`       | Link ratio              | External links don't exceed internal links by 3:1        | Info     | -3                          |
| `MISSING_FAQ_STRUCTURE` | Q&A format              | Content addressing common questions uses Q&A structure   | Info     | -5                          |

### 7.4 AI Readiness Factors (10 factors)

| Code                     | Factor              | Check                                                      | Severity | Score Impact               |
| ------------------------ | ------------------- | ---------------------------------------------------------- | -------- | -------------------------- |
| `MISSING_LLMS_TXT`       | llms.txt file       | /llms.txt exists with valid content                        | Critical | -20                        |
| `AI_CRAWLER_BLOCKED`     | AI bot access       | robots.txt does not block GPTBot, ClaudeBot, PerplexityBot | Critical | -25                        |
| `NO_STRUCTURED_DATA`     | Schema markup       | JSON-LD structured data present                            | Warning  | -15                        |
| `INCOMPLETE_SCHEMA`      | Schema completeness | Required schema properties populated                       | Warning  | -8                         |
| `CITATION_WORTHINESS`    | LLM citation score  | LLM assessment: would an AI cite this? (0-100)             | Varies   | Mapped to 0-20 point range |
| `NO_DIRECT_ANSWERS`      | Answer format       | Content contains direct, concise answers to likely queries | Warning  | -10                        |
| `MISSING_ENTITY_MARKUP`  | Named entities      | Key entities marked up in schema                           | Info     | -5                         |
| `NO_SUMMARY_SECTION`     | TL;DR / Summary     | Page has a summary or key takeaway section                 | Info     | -5                         |
| `POOR_QUESTION_COVERAGE` | Query alignment     | Content addresses likely search queries for the topic      | Warning  | -10                        |
| `INVALID_SCHEMA`         | Schema validity     | JSON-LD parses without errors                              | Warning  | -8                         |

### 7.5 Performance Factors (5 factors)

| Code              | Factor                    | Check                                   | Severity     | Score Impact                  |
| ----------------- | ------------------------- | --------------------------------------- | ------------ | ----------------------------- |
| `LH_PERF_LOW`     | Lighthouse Performance    | Score >= 0.5 (warning) or >= 0.8 (pass) | Warning/Info | -20 if < 0.5, -10 if 0.5-0.79 |
| `LH_SEO_LOW`      | Lighthouse SEO            | Score >= 0.8                            | Warning      | -15 if < 0.8                  |
| `LH_A11Y_LOW`     | Lighthouse Accessibility  | Score >= 0.7                            | Info         | -5 if < 0.7                   |
| `LH_BP_LOW`       | Lighthouse Best Practices | Score >= 0.8                            | Info         | -5 if < 0.8                   |
| `LARGE_PAGE_SIZE` | Page weight               | Total page size < 3MB                   | Warning      | -10 if > 3MB                  |

### 7.6 Score Calculation Algorithm

```
For each page:
  1. Start with base score = 100
  2. Apply all factor deductions (never below 0)
  3. Calculate category scores:
     - technical_score = max(0, 100 + sum(technical_deductions))
     - content_score = max(0, 100 + sum(content_deductions))
     - ai_readiness_score = max(0, 100 + sum(ai_readiness_deductions))
     - performance_score = max(0, 100 + sum(performance_deductions))
  4. Calculate overall score:
     overall = (technical_score * 0.25) + (content_score * 0.30)
             + (ai_readiness_score * 0.30) + (performance_score * 0.15)
  5. Assign letter grade: A (90+), B (80-89), C (70-79), D (60-69), F (<60)
  6. Generate issues array with all triggered factors
  7. Sort issues by severity (critical > warning > info) then by score impact
```

---

## 8. Technical Architecture

### 8.1 System Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    CLOUDFLARE EDGE                       │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ Next.js  │  │ Workers  │  │    D1    │  │   R2   │ │
│  │ (Pages)  │→ │  (Hono)  │→ │ (SQLite) │  │(Object)│ │
│  │Dashboard │  │  API     │  │ Metadata │  │Storage │ │
│  └──────────┘  └────┬─────┘  └──────────┘  └────────┘ │
│                     │                                    │
│  ┌──────────┐  ┌────┴─────┐                             │
│  │    KV    │  │   LLM    │                             │
│  │  Cache   │  │ Package  │                             │
│  └──────────┘  └──────────┘                             │
└─────────────────────┬───────────────────────────────────┘
                      │ HMAC-authenticated HTTP
                      ▼
┌─────────────────────────────────────────────────────────┐
│                    HETZNER VPS                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Docker Container                     │   │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │   │
│  │  │  Axum    │  │  Crawler │  │  Lighthouse   │  │   │
│  │  │  HTTP    │→ │  Engine  │→ │  (Node.js +   │  │   │
│  │  │  Server  │  │  (Tokio) │  │   Chromium)   │  │   │
│  │  └──────────┘  └──────────┘  └───────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 8.2 Architecture Decision Records

| Decision           | Choice                              | Rationale                                                         | Alternatives Considered      |
| ------------------ | ----------------------------------- | ----------------------------------------------------------------- | ---------------------------- |
| Primary Database   | Cloudflare D1 (SQLite)              | Zero-config, globally distributed, free tier covers MVP           | Planetscale, Turso, Supabase |
| Object Storage     | Cloudflare R2                       | No egress fees, S3-compatible API, same provider                  | AWS S3, Backblaze B2         |
| API Framework      | Hono                                | Designed for Workers, minimal bundle, Express-like DX             | itty-router, Worktop         |
| Crawler Language   | Rust                                | Memory safety, async performance, reliable long-running processes | Node.js, Go                  |
| Auth Provider      | Clerk (primary) or Lucia (fallback) | Clerk: fastest to implement, great UX. Lucia: self-hosted         | NextAuth.js, custom JWT      |
| Queue System (MVP) | Tokio mpsc channels                 | Simplest deployment, no external deps                             | Redis, NATS                  |
| ORM                | Drizzle ORM                         | Type-safe, lightweight, D1-native, excellent migrations           | Kysely, raw SQL              |

---

## 9. Repository Structure

```
ai-seo-platform/
├── apps/
│   ├── web/                    # Next.js frontend (Cloudflare Pages)
│   │   ├── app/                # App router pages
│   │   │   ├── (auth)/         # Login, signup, verify
│   │   │   ├── (dashboard)/    # Authenticated dashboard routes
│   │   │   │   ├── projects/   # Project list, create, detail
│   │   │   │   ├── crawl/      # Crawl progress, results
│   │   │   │   ├── visibility/ # AI visibility tracking
│   │   │   │   ├── settings/   # User settings, billing
│   │   │   │   └── page.tsx    # Dashboard overview
│   │   │   └── (marketing)/    # Public pages (landing, pricing)
│   │   ├── components/         # Reusable UI components
│   │   ├── lib/                # Client-side utilities
│   │   └── styles/             # Tailwind config, globals
│   └── crawler/                # Rust crawler service (Hetzner Docker)
│       ├── src/
│       │   ├── main.rs         # Axum HTTP server
│       │   ├── config.rs       # Environment config
│       │   ├── server/         # Route handlers, auth
│       │   ├── crawler/        # Crawl engine, frontier, fetcher, parser
│       │   ├── lighthouse/     # Lighthouse CLI integration
│       │   ├── storage/        # R2 upload, callback POST
│       │   ├── jobs/           # Job manager, queue
│       │   └── models.rs       # Shared data structures
│       ├── Dockerfile
│       └── docker-compose.yml
├── packages/
│   ├── api/                    # Cloudflare Workers (Hono)
│   ├── shared/                 # Shared TypeScript types & Zod schemas
│   ├── db/                     # D1 schema & Drizzle ORM queries
│   ├── scoring/                # Scoring engine (37 factors)
│   └── llm/                    # LLM orchestration layer
├── infra/
│   ├── docker/                 # Dockerfile + compose
│   ├── migrations/             # D1 SQL migrations
│   └── scripts/                # Deploy, seed, utility scripts
├── turbo.json
├── package.json
├── wrangler.toml
└── .github/workflows/          # CI/CD pipelines
```

| Package          | Runtime              | Purpose                                                             |
| ---------------- | -------------------- | ------------------------------------------------------------------- |
| apps/web         | Cloudflare Pages     | Next.js dashboard, auth UI, project management, report views        |
| apps/crawler     | Hetzner Docker       | Rust HTTP server: crawl jobs, Lighthouse, data extraction           |
| packages/api     | Cloudflare Workers   | REST API: auth, billing, job scheduling, ingest, LLM orchestration  |
| packages/shared  | Build-time only      | TypeScript interfaces, Zod schemas, API contract types, error codes |
| packages/db      | Workers (D1 binding) | Drizzle ORM schema, migration files, typed query helpers            |
| packages/scoring | Workers              | 30+ scoring factor calculations, per-page and per-site aggregation  |
| packages/llm     | Workers              | Prompt templates, batching logic, caching layer, cost tracking      |

---

## 10. Database Schema

### 10.1 Users & Authentication

```sql
CREATE TABLE users (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email         TEXT NOT NULL UNIQUE,
  name          TEXT,
  avatar_url    TEXT,
  plan          TEXT NOT NULL DEFAULT 'free'
                CHECK(plan IN ('free','starter','pro','agency')),
  stripe_customer_id  TEXT,
  stripe_sub_id       TEXT,
  crawl_credits_remaining  INTEGER NOT NULL DEFAULT 100,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 10.2 Projects

```sql
CREATE TABLE projects (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  domain        TEXT NOT NULL,
  settings      TEXT DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_projects_user ON projects(user_id);
```

### 10.3 Crawl Jobs

```sql
CREATE TABLE crawl_jobs (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK(status IN ('pending','queued','crawling','scoring',
                                 'complete','failed','cancelled')),
  config        TEXT NOT NULL,
  pages_found   INTEGER DEFAULT 0,
  pages_crawled INTEGER DEFAULT 0,
  pages_scored  INTEGER DEFAULT 0,
  error_message TEXT,
  r2_prefix     TEXT,
  started_at    TEXT,
  completed_at  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_jobs_project ON crawl_jobs(project_id);
CREATE INDEX idx_jobs_status ON crawl_jobs(status);
```

### 10.4 Pages

```sql
CREATE TABLE pages (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  job_id        TEXT NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  canonical_url TEXT,
  status_code   INTEGER,
  title         TEXT,
  meta_desc     TEXT,
  content_hash  TEXT,
  word_count    INTEGER,
  r2_raw_key    TEXT,
  r2_lh_key     TEXT,
  crawled_at    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_pages_job ON pages(job_id);
CREATE INDEX idx_pages_url ON pages(project_id, url);
```

### 10.5 Scores & Issues

```sql
CREATE TABLE page_scores (
  id                 TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  page_id            TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  job_id             TEXT NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
  overall_score      REAL NOT NULL,
  technical_score    REAL,
  content_score      REAL,
  ai_readiness_score REAL,
  lighthouse_perf    REAL,
  lighthouse_seo     REAL,
  detail             TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE issues (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  page_id        TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  job_id         TEXT NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
  category       TEXT NOT NULL
                 CHECK(category IN ('technical','content','ai_readiness',
                                    'performance','schema','llm_visibility')),
  severity       TEXT NOT NULL CHECK(severity IN ('critical','warning','info')),
  code           TEXT NOT NULL,
  message        TEXT NOT NULL,
  recommendation TEXT,
  data           TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_issues_page ON issues(page_id);
CREATE INDEX idx_issues_severity ON issues(job_id, severity);
```

### 10.6 AI Visibility Tracking

```sql
CREATE TABLE visibility_checks (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  llm_provider      TEXT NOT NULL
                    CHECK(llm_provider IN ('chatgpt','claude','perplexity','gemini','copilot')),
  query             TEXT NOT NULL,
  response_text     TEXT,
  brand_mentioned   BOOLEAN DEFAULT 0,
  url_cited         BOOLEAN DEFAULT 0,
  citation_position INTEGER,
  competitor_mentions TEXT,
  r2_response_key   TEXT,
  checked_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_vis_project ON visibility_checks(project_id, checked_at);
```

---

## 11. API Contracts

### 11.1 Job Submission (Cloudflare → Hetzner)

**POST /api/v1/jobs**

```json
{
  "job_id": "abc123",
  "callback_url": "https://api.yourdomain.com/ingest/crawl-result",
  "config": {
    "seed_urls": ["https://example.com"],
    "max_pages": 50,
    "max_depth": 3,
    "respect_robots": true,
    "run_lighthouse": true,
    "extract_schema": true,
    "extract_links": true,
    "check_llms_txt": true,
    "user_agent": "AISEOBot/1.0",
    "rate_limit_ms": 1000,
    "timeout_s": 30
  }
}
```

### 11.2 Result Streaming (Hetzner → Cloudflare)

**POST to callback_url: CrawlResultBatch**

```json
{
  "job_id": "abc123",
  "batch_index": 0,
  "is_final": false,
  "pages": [
    {
      "url": "https://example.com/about",
      "status_code": 200,
      "title": "About Us | Example",
      "meta_description": "Learn about Example...",
      "canonical_url": "https://example.com/about",
      "word_count": 1420,
      "content_hash": "sha256:...",
      "html_r2_key": "crawls/abc123/pages/about.html.gz",
      "extracted": {
        "h1": ["About Us"],
        "h2": ["Our Mission", "Team"],
        "schema_types": ["Organization", "WebPage"],
        "internal_links": ["/contact", "/team"],
        "external_links": ["https://twitter.com/example"],
        "images_without_alt": 2,
        "has_robots_meta": true,
        "robots_directives": ["index", "follow"],
        "og_tags": { "og:title": "About Us" },
        "structured_data": [{ "@type": "Organization" }]
      },
      "lighthouse": {
        "performance": 0.85,
        "seo": 0.92,
        "accessibility": 0.88,
        "best_practices": 0.9,
        "lh_r2_key": "crawls/abc123/lighthouse/about.json.gz"
      },
      "timing_ms": 1250
    }
  ],
  "stats": {
    "pages_found": 142,
    "pages_crawled": 25,
    "pages_errored": 1,
    "elapsed_s": 32
  }
}
```

### 11.3 Job Control Endpoints

| Endpoint                     | Method | Direction | Purpose                       |
| ---------------------------- | ------ | --------- | ----------------------------- |
| POST /api/v1/jobs            | POST   | CF → HZ   | Submit new crawl job          |
| GET /api/v1/jobs/:id/status  | GET    | CF → HZ   | Poll job progress             |
| POST /api/v1/jobs/:id/cancel | POST   | CF → HZ   | Cancel running job            |
| POST /ingest/crawl-result    | POST   | HZ → CF   | Stream page results back      |
| POST /ingest/job-complete    | POST   | HZ → CF   | Signal job completion/failure |

### 11.4 Authentication

```
Headers:
  X-Signature: hmac-sha256=<hex(HMAC(secret, timestamp + body))>
  X-Timestamp: <unix_epoch_seconds>
  Content-Type: application/json
```

### 11.5 Dashboard API Endpoints

| Endpoint                       | Method | Auth       | Purpose                            |
| ------------------------------ | ------ | ---------- | ---------------------------------- |
| POST /api/auth/signup          | POST   | None       | Create account                     |
| POST /api/auth/login           | POST   | None       | Login, receive session token       |
| GET /api/projects              | GET    | Bearer     | List user's projects               |
| POST /api/projects             | POST   | Bearer     | Create new project                 |
| GET /api/projects/:id          | GET    | Bearer     | Get project detail + latest scores |
| PUT /api/projects/:id          | PUT    | Bearer     | Update project settings            |
| DELETE /api/projects/:id       | DELETE | Bearer     | Delete project (soft delete)       |
| POST /api/projects/:id/crawl   | POST   | Bearer     | Start new crawl                    |
| GET /api/crawls/:id            | GET    | Bearer     | Get crawl status + progress        |
| GET /api/crawls/:id/results    | GET    | Bearer     | Get full crawl results (paginated) |
| GET /api/pages/:id             | GET    | Bearer     | Get single page detail + issues    |
| GET /api/pages/:id/score       | GET    | Bearer     | Get page score breakdown           |
| GET /api/projects/:id/issues   | GET    | Bearer     | List all issues (filterable)       |
| GET /api/projects/:id/history  | GET    | Bearer     | Get crawl history for comparison   |
| POST /api/visibility/check     | POST   | Bearer     | Run visibility check               |
| GET /api/visibility/:projectId | GET    | Bearer     | Get visibility results             |
| GET /api/billing/usage         | GET    | Bearer     | Get current usage against limits   |
| POST /api/billing/checkout     | POST   | Bearer     | Create Stripe checkout session     |
| POST /api/billing/webhook      | POST   | Stripe sig | Handle Stripe webhooks             |

### 11.6 Error Response Format

```json
{
  "error": {
    "code": "CRAWL_LIMIT_REACHED",
    "message": "You have used all your crawl credits for this month.",
    "details": { "used": 30, "limit": 30, "resets_at": "2026-03-01T00:00:00Z" }
  }
}
```

| Code                  | HTTP Status | Description                              |
| --------------------- | ----------- | ---------------------------------------- |
| `UNAUTHORIZED`        | 401         | Missing or invalid auth token            |
| `FORBIDDEN`           | 403         | Valid token but insufficient permissions |
| `NOT_FOUND`           | 404         | Resource does not exist                  |
| `PLAN_LIMIT_REACHED`  | 403         | Feature requires higher plan             |
| `CRAWL_LIMIT_REACHED` | 429         | Monthly crawl credits exhausted          |
| `CRAWL_IN_PROGRESS`   | 409         | Another crawl is already running         |
| `INVALID_DOMAIN`      | 422         | Domain URL is unreachable or invalid     |
| `HMAC_INVALID`        | 401         | HMAC signature verification failed       |
| `RATE_LIMITED`        | 429         | Too many requests                        |

---

## 12. Rust Crawler Implementation

### 12.1 Concurrency Model

| Component       | Mechanism                  | Details                                                          |
| --------------- | -------------------------- | ---------------------------------------------------------------- |
| Job Queue       | tokio::sync::mpsc          | Bounded channel (capacity = max concurrent jobs, default 5)      |
| URL Frontier    | Arc\<Mutex\<BinaryHeap\>\> | Priority queue sorted by depth, deduped via HashSet              |
| Fetch Workers   | tokio::JoinSet             | Configurable worker pool (default 10 concurrent fetches per job) |
| Rate Limiter    | governor::RateLimiter      | Per-domain token bucket, configurable ms between requests        |
| Result Batching | tokio::sync::mpsc          | Accumulate N pages or T seconds, then POST batch to callback     |
| Cancellation    | CancellationToken          | Cooperative cancellation propagated to all child tasks           |

### 12.2 Core Crawl Loop (Pseudocode)

```rust
async fn crawl_job(config: CrawlConfig, cancel: CancellationToken) {
    let frontier = Frontier::new(config.seed_urls);
    let limiter = RateLimiter::per_domain(config.rate_limit_ms);
    let (batch_tx, batch_rx) = mpsc::channel(100);
    tokio::spawn(batch_sender(batch_rx, config.callback_url));

    let mut workers = JoinSet::new();
    while let Some(url) = frontier.pop() {
        if cancel.is_cancelled() { break; }
        if frontier.crawled_count() >= config.max_pages { break; }
        limiter.acquire(url.domain()).await;
        let tx = batch_tx.clone();
        workers.spawn(async move {
            let html = fetch(&url).await?;
            let extracted = extract_all(&html);
            let lh = if config.run_lighthouse {
                Some(run_lighthouse(&url).await?)
            } else { None };
            upload_to_r2(&html, &lh).await?;
            tx.send(PageResult { url, extracted, lh }).await
        });
        while let Some(result) = workers.try_join_next() {
            if let Ok(page) = result {
                frontier.add_discovered(page.extracted.internal_links);
            }
        }
    }
    workers.join_all().await;
}
```

### 12.3 Docker Setup

```dockerfile
FROM rust:1.76-slim AS builder
WORKDIR /app
COPY apps/crawler/ .
RUN cargo build --release

FROM node:20-slim
RUN apt-get update && apt-get install -y chromium && npm install -g lighthouse
COPY --from=builder /app/target/release/crawler /usr/local/bin/
ENV CHROME_PATH=/usr/bin/chromium
EXPOSE 8080
CMD ["crawler"]
```

### 12.4 Queue Scaling Path

| Scale                | Queue               | When to Use                                        |
| -------------------- | ------------------- | -------------------------------------------------- |
| MVP (1 server)       | Tokio mpsc channels | 0-50 concurrent jobs, single Hetzner instance      |
| Growth (2-3 servers) | Redis (via Hetzner) | Job persistence across restarts, multiple crawlers |
| Scale (5+ servers)   | NATS JetStream      | High throughput, exactly-once delivery, clustering |

---

## 13. LLM Integration Strategy

### 13.1 Three Usage Modes

| Mode                | Purpose                            | Frequency                | Cost Profile              |
| ------------------- | ---------------------------------- | ------------------------ | ------------------------- |
| Content Scoring     | Evaluate page content quality      | Per page per crawl       | Medium (batch-able)       |
| Query Simulation    | Test how LLMs answer brand queries | Per project per check    | High (multiple LLM calls) |
| Visibility Tracking | Monitor brand mentions across LLMs | Scheduled (daily/weekly) | Low-Medium (cacheable)    |

### 13.2 Batching & Cost Optimization

| Strategy                | Implementation                                            | Savings  |
| ----------------------- | --------------------------------------------------------- | -------- |
| Content-hash caching    | Cache LLM scores in KV by SHA256(content)                 | 50-70%   |
| Batch API calls         | Use Anthropic/OpenAI batch APIs (50% discount)            | 50%      |
| Tiered models           | Haiku/GPT-4o-mini for screening, Sonnet/GPT-4o for detail | 60-70%   |
| Prompt compression      | Send extracted text only, truncate to 4K tokens           | 30-40%   |
| Cache visibility checks | Cache responses for same query+provider for 24h           | 40-60%   |
| Incremental scoring     | Only re-score pages where content_hash changed            | Variable |

### 13.3 Cost Estimates Per Crawl

| Plan             | Pages      | LLM Calls                     | Est. Cost/Crawl |
| ---------------- | ---------- | ----------------------------- | --------------- |
| Free             | 10 pages   | 10 (Haiku only)               | ~$0.01          |
| Starter ($79/mo) | 100 pages  | 100 screening + 20 detailed   | ~$0.15          |
| Pro ($149/mo)    | 500 pages  | 500 screening + 100 detailed  | ~$0.80          |
| Agency ($299/mo) | 2000 pages | 2000 screening + 500 detailed | ~$3.50          |

---

## 14. User Experience Requirements

### 14.1 Design Principles

1. **Clarity over cleverness** — Every metric, score, and recommendation must be understandable by a non-technical marketer
2. **Action over information** — Show what to DO, not just what IS wrong
3. **Progress over perfection** — Celebrate improvements, show trends, motivate continued optimization
4. **Speed over features** — Dashboard loads < 2s, results appear as crawl progresses

### 14.2 Key Screens

**Dashboard Overview:** Project cards (domain, last score, trend arrow, issue count), "Add Project" CTA, usage summary.

**Project Detail / Crawl Results:** Hero score (large circle chart, letter grade), score breakdown bar, issues summary (critical/warning/info), "Top 5 Fixes" with estimated impact, page list table (sortable, filterable, searchable).

**Page Detail:** Page URL/title, score breakdown radar chart, issues with expandable inline recommendations, content scoring results (paid), raw extracted data (expandable).

**Issue Detail:** Issue title + severity badge, "What this means" explanation, "Why it matters for AI search," "How to fix it" step-by-step, "Pages affected" list.

**AI Visibility Dashboard:** Query list with per-provider results, competitor comparison table, trend chart, "Add Query" and "Run Check" actions.

**Settings & Billing:** Account settings, plan & usage bars, billing history, project settings.

**Onboarding (First-Run):** 3 steps: Enter URL → Choose settings → Start crawl.

### 14.3 Navigation Architecture

```
Sidebar Navigation:
├── Dashboard (overview of all projects)
├── Projects
│   └── [Project Name]
│       ├── Overview (latest crawl results)
│       ├── Pages (page list with scores)
│       ├── Issues (all issues, filterable)
│       ├── Visibility (AI mention tracking)
│       ├── History (crawl comparison)
│       └── Settings (project config)
├── Settings (Account, Billing, Notifications)
└── Help / Docs
```

### 14.4 Accessibility & Responsive Design

- WCAG 2.1 AA compliance
- All interactive elements keyboard navigable
- Color never the sole indicator of meaning (paired with icons/text)
- Minimum contrast ratio 4.5:1 for text
- Desktop-first design; tablet: full functionality with condensed tables; mobile: view scores and issues, initiate crawls
- Minimum supported viewport: 375px width

---

## 15. Non-Functional Requirements

### 15.1 Performance

| Metric                     | Target                                  |
| -------------------------- | --------------------------------------- |
| Dashboard page load        | < 2 seconds (TTI)                       |
| API response time (reads)  | < 200ms (p95)                           |
| API response time (writes) | < 500ms (p95)                           |
| Crawl initiation           | < 3 seconds from click to progress view |
| Concurrent crawl jobs      | 5 per Hetzner instance                  |
| Concurrent dashboard users | 500+                                    |
| Lighthouse audit per page  | < 60 seconds                            |

### 15.2 Reliability & Availability

| Metric                          | Target                       |
| ------------------------------- | ---------------------------- |
| Overall uptime                  | 99.5% (~3.6h downtime/month) |
| Cloudflare Workers availability | 99.9% (CF SLA)               |
| Hetzner crawler availability    | 99% (single VPS)             |
| Data durability                 | 99.999% (D1 + R2)            |
| API error rate                  | < 1% of requests return 5xx  |
| Crawl job success rate          | > 95%                        |

### 15.3 Security

| Requirement           | Implementation                                                |
| --------------------- | ------------------------------------------------------------- |
| Authentication        | Clerk or Lucia with secure session management                 |
| API Authorization     | Bearer tokens with JWT, plan-based access control             |
| Crawler Communication | HMAC-SHA256 signed payloads with timestamp replay protection  |
| Data Encryption       | TLS 1.3 in transit, D1 encryption at rest                     |
| API Rate Limiting     | 100 req/min per user, 10 crawl submissions/hour               |
| Input Validation      | Zod schemas on all API inputs, parameterized queries          |
| GDPR Compliance       | Data deletion on account closure, data export, privacy policy |
| Secrets Management    | All API keys in env vars, never in code or logs               |
| Dependency Security   | npm audit + cargo audit in CI                                 |

### 15.4 Scalability

| Phase      | Users     | Pages/Month | Infrastructure                              |
| ---------- | --------- | ----------- | ------------------------------------------- |
| Launch     | 0-100     | 50K         | 1 Hetzner VPS, CF free tier                 |
| Growth     | 100-500   | 250K        | 1-2 Hetzner VPS, CF paid tier               |
| Scale      | 500-2,000 | 1M+         | 3+ Hetzner VPS with Redis, D1 replicas      |
| Enterprise | 2,000+    | 5M+         | Dedicated crawl cluster, Postgres migration |

### 15.5 Backup & Recovery

| Component         | Strategy                             | Recovery Time |
| ----------------- | ------------------------------------ | ------------- |
| D1 Database       | CF auto backups + daily export to R2 | < 1 hour      |
| R2 Object Storage | Cross-region replication (built-in)  | Automatic     |
| Crawler Config    | Docker image + compose in Git        | < 15 minutes  |
| Application Code  | Git repository (GitHub)              | < 10 minutes  |
| Secrets           | Documented in secure vault           | < 5 minutes   |

---

## 16. Success Metrics & Analytics

### 16.1 North Star Metric

**Pages scored per week** — captures product engagement, breadth, and retention.

### 16.2 Key Performance Indicators

| Category     | Metric                              | Target (6-Month) |
| ------------ | ----------------------------------- | ---------------- |
| Acquisition  | Monthly signups                     | 500              |
| Activation   | % completing first crawl within 24h | 60%              |
| Engagement   | Crawls per active user per month    | 3+               |
| Retention    | 30-day retention rate               | 40%              |
| Revenue      | MRR                                 | $15K             |
| Revenue      | Free-to-paid conversion             | 8%               |
| Revenue      | Monthly churn rate                  | < 8%             |
| Satisfaction | NPS score                           | 40+              |

### 16.3 Analytics Event Tracking Plan

| Event Name                    | Trigger                     | Properties                               | KPI Fed          |
| ----------------------------- | --------------------------- | ---------------------------------------- | ---------------- |
| `user_signed_up`              | Account created             | plan, source, referrer                   | Acquisition      |
| `project_created`             | New project added           | domain, user_plan                        | Activation       |
| `crawl_started`               | Crawl initiated             | project_id, max_pages, depth             | Engagement       |
| `crawl_completed`             | Crawl finishes              | pages_crawled, duration_s, overall_score | Engagement       |
| `page_detail_viewed`          | User clicks into page       | page_score, issue_count                  | Engagement       |
| `issue_recommendation_viewed` | User expands recommendation | issue_code, severity                     | Product value    |
| `visibility_check_run`        | Visibility check executed   | query_count, providers                   | Feature adoption |
| `report_exported`             | PDF report downloaded       | format, page_count                       | Feature adoption |
| `upgrade_initiated`           | User clicks upgrade CTA     | from_plan, to_plan, trigger              | Revenue          |
| `upgrade_completed`           | Stripe checkout succeeded   | plan, price                              | Revenue          |
| `subscription_cancelled`      | User cancels                | plan, reason, tenure_months              | Churn            |
| `crawl_compared`              | User views comparison       | score_delta, issues_resolved             | Retention        |

### 16.4 Tools

| Purpose                   | Tool                                 |
| ------------------------- | ------------------------------------ |
| Product analytics         | PostHog (self-hosted or cloud)       |
| Error tracking            | Sentry                               |
| Infrastructure monitoring | Cloudflare Analytics + Grafana Cloud |
| Revenue analytics         | Stripe Dashboard + ProfitWell        |
| User feedback             | In-app widget + Canny                |

---

## 17. MVP Feature Prioritization

### Phase 1: Core Crawler & Technical Audit (Weeks 1-6)

| Feature                                            | Priority | Effort  |
| -------------------------------------------------- | -------- | ------- |
| Rust crawler with configurable depth/pages         | P0       | 2 weeks |
| HTML extraction (meta, headings, links, schema)    | P0       | 1 week  |
| robots.txt + sitemap.xml parsing                   | P0       | 3 days  |
| llms.txt detection and analysis                    | P0       | 2 days  |
| Lighthouse integration                             | P0       | 1 week  |
| D1 schema + Drizzle ORM setup                      | P0       | 3 days  |
| R2 storage for raw HTML + Lighthouse JSON          | P0       | 2 days  |
| Basic scoring engine (technical factors only)      | P0       | 1 week  |
| Worker API: submit job, get results                | P0       | 3 days  |
| Minimal Next.js dashboard: submit URL, view report | P0       | 1 week  |

### Phase 2: AI Content Scoring & User Management (Weeks 7-12)

| Feature                                             | Priority | Effort  |
| --------------------------------------------------- | -------- | ------- |
| LLM content scoring (clarity, authority, structure) | P0       | 2 weeks |
| Auth (Clerk or Lucia) + user dashboard              | P0       | 1 week  |
| Project CRUD + multi-domain support                 | P0       | 3 days  |
| Issue detection + prioritized recommendations       | P0       | 1 week  |
| Per-page detail view with score breakdown           | P1       | 1 week  |
| Site-level aggregation + overview dashboard         | P1       | 3 days  |
| Crawl history + comparison between runs             | P1       | 1 week  |
| Email notifications (crawl complete)                | P2       | 2 days  |

### Phase 3: AI Visibility & Monetization (Weeks 13-20)

| Feature                                             | Priority | Effort  |
| --------------------------------------------------- | -------- | ------- |
| AI visibility tracking (multi-LLM query simulation) | P0       | 2 weeks |
| Stripe billing integration (4 tiers)                | P0       | 1 week  |
| Usage metering + crawl credit system                | P0       | 3 days  |
| Scheduled crawls (daily/weekly/monthly)             | P1       | 1 week  |
| Competitor tracking (visibility comparison)         | P1       | 1 week  |
| PDF/white-label report export                       | P1       | 1 week  |
| API access for Pro/Agency tiers                     | P2       | 1 week  |
| Agency white-labeling (custom branding)             | P2       | 2 weeks |

---

## 18. 90-Day Sprint Plan

### MVP Scope Boundaries

**IN:** Technical crawling, 30+ factor scoring, issue detection with recommendations, basic dashboard, single-user (no auth needed for MVP demo)

**OUT:** LLM content scoring, AI visibility tracking, billing, scheduled crawls, team management, white-label

### Sprint Schedule

**Days 1-14: Foundation Sprint**
Sprint Goal: "A Worker can accept a crawl request, store data in D1, and serve results via API"

- Initialize Turborepo monorepo with all packages
- Define TypeScript interfaces in packages/shared
- Set up D1 schema with Drizzle ORM
- Create Hono Worker API with health check, job submission, and ingest endpoints
- Set up R2 bucket, deploy Worker, verify bindings in production
- Demo: curl commands successfully submit, ingest, and retrieve crawl data

**Days 15-28: Crawler Sprint**
Sprint Goal: "The Rust crawler can crawl a real website and send results back to Cloudflare"

- Scaffold Rust project with Axum, reqwest, scraper, tokio
- Implement single-page fetcher with full HTML extraction
- Add robots.txt parsing, llms.txt detection, URL frontier with BFS
- Implement R2 upload, callback POST, Lighthouse CLI integration
- Docker build + deploy to Hetzner, test end-to-end pipeline
- Demo: Real URL → Hetzner crawls 10 pages → results in D1 with Lighthouse scores

**Days 29-42: Scoring + Dashboard Sprint**
Sprint Goal: "A user can enter a URL in the browser and see a scored report with issues"

- Build scoring engine (all 37 factors) with deterministic unit tests (50+ cases)
- Implement issue detection with recommendation text templates
- Create Next.js dashboard: URL input → progress → results → page detail
- Deploy to Cloudflare Pages, test full pipeline
- Demo: User enters URL → sees real-time crawl progress → views scored results. This is the MVP.

**Days 43-56: Auth + Projects Sprint**
Sprint Goal: "Users can create accounts, manage projects, and see historical data"

- Integrate Clerk auth, add user-scoped data access
- Build project management UI, plan-based limit enforcement
- Build crawl history and comparison views
- Set up PostHog analytics tracking
- Demo: Authenticated user creates project, runs crawls, sees improvement trends

**Days 57-70: AI Scoring + Billing Sprint**
Sprint Goal: "Paid users get AI-powered content scoring; Stripe billing works end-to-end"

- Implement LLM content scoring with content-hash caching
- Integrate tiered models (Haiku for free, Sonnet for paid)
- Integrate Stripe: pricing page, checkout, webhooks, usage metering
- Demo: Free user → upgrades → gets AI analysis → billing works correctly

**Days 71-90: Visibility + Launch Sprint**
Sprint Goal: "AI visibility tracking works; platform is launch-ready"

- Build AI visibility checker (ChatGPT, Claude, Perplexity), create dashboard
- Security audit, performance optimization, error monitoring
- Create documentation, landing page, support FAQ
- Soft launch to 10-20 beta users from SEO communities
- Demo: Full platform walkthrough end-to-end

---

## 19. Testing Strategy

### 19.1 Unit Tests

| Package          | What to Test                                         | Coverage Target |
| ---------------- | ---------------------------------------------------- | --------------- |
| packages/scoring | Every scoring factor, correct score for known inputs | 90%+            |
| packages/scoring | Issue detection at correct thresholds                | 90%+            |
| packages/scoring | Site-level aggregation math                          | 90%+            |
| packages/llm     | Prompt construction determinism                      | 80%+            |
| packages/llm     | Content-hash caching                                 | 80%+            |
| packages/shared  | Zod schema validation/rejection                      | 90%+            |
| packages/db      | Query helper return shapes                           | 70%+            |

### 19.2 Integration Tests

| Test             | Components                          | Verification                                      |
| ---------------- | ----------------------------------- | ------------------------------------------------- |
| Crawl submission | Worker API → D1 → POST to Hetzner   | Job created, correct payload sent                 |
| Result ingestion | Hetzner POST → Worker → D1 + R2     | Pages stored, scores calculated                   |
| HMAC auth        | Worker ↔ Crawler                    | Valid accepted, invalid rejected, replays blocked |
| Auth flow        | Next.js → Clerk → Worker API        | Login produces valid session                      |
| Stripe billing   | Checkout → webhook → D1 plan update | Plan upgrades, credits allocated                  |
| Plan limits      | API middleware                      | Free blocked at limit, paid allowed               |

### 19.3 End-to-End Tests

| Scenario             | Expected Outcome                                                    |
| -------------------- | ------------------------------------------------------------------- |
| New user first crawl | Crawl completes, scores display, issues listed with recommendations |
| Re-crawl after fixes | Score delta shown, resolved issues highlighted                      |
| Plan upgrade         | Immediate access to higher limits, AI scoring available             |
| Visibility check     | Brand mention/citation results displayed per provider               |

### 19.4 Performance & Security Tests

| Test                           | Pass Criteria                                           |
| ------------------------------ | ------------------------------------------------------- |
| Dashboard load (Lighthouse CI) | Performance > 80, TTI < 2s                              |
| API latency (k6)               | p95 < 200ms at 100 concurrent users                     |
| Crawl throughput               | 50 pages in < 5 minutes including Lighthouse            |
| SQL injection                  | Parameterized queries only, no raw string interpolation |
| XSS prevention                 | All user content escaped, CSP headers set               |
| Auth bypass                    | 401 without valid token, cross-user access blocked      |
| HMAC replay                    | Timestamps > 5 minutes old rejected                     |

---

## 20. Launch Criteria

### 20.1 Technical Readiness (All Must Pass)

- [ ] All P0 Phase 1-3 features functional and passing acceptance criteria
- [ ] Scoring engine produces correct results for 50+ test cases
- [ ] Crawl pipeline works end-to-end: URL input → results display
- [ ] Auth system secure: login, logout, session management, password reset
- [ ] Stripe billing works: checkout, upgrade, downgrade, cancel, webhooks
- [ ] API error rate < 1% under expected load
- [ ] Dashboard page load < 2 seconds (Lighthouse performance > 80)
- [ ] No critical or high-severity security vulnerabilities
- [ ] Error monitoring (Sentry) and infrastructure monitoring (Grafana) configured

### 20.2 Business Readiness (All Must Pass)

- [ ] Pricing page live with all 4 tiers clearly explained
- [ ] Stripe products/prices configured for all tiers
- [ ] Terms of Service and Privacy Policy published
- [ ] Getting Started guide / onboarding documentation complete
- [ ] Support email configured
- [ ] Landing page with value proposition, screenshots, and signup CTA
- [ ] Analytics tracking verified (all events firing correctly)

### 20.3 Go/No-Go Decision

**Go if:** All technical and business readiness items pass, and at least 5 beta users have completed the full workflow without critical issues.

**No-Go if:** Any critical security issue unresolved, Stripe not processing correctly, or crawl success rate < 90%.

---

## 21. Cost Optimization

### 21.1 Tier-Based Resource Limits

| Resource             | Free          | Starter ($79) | Pro ($149)    | Agency ($299) |
| -------------------- | ------------- | ------------- | ------------- | ------------- |
| Pages per crawl      | 10            | 100           | 500           | 2,000         |
| Max crawl depth      | 2             | 3             | 5             | 10            |
| Crawls per month     | 2             | 10            | 30            | Unlimited     |
| Projects             | 1             | 5             | 20            | 50            |
| Lighthouse audits    | 5 pages       | All pages     | All pages     | All pages     |
| LLM content scoring  | Basic (Haiku) | Full (Sonnet) | Full (Sonnet) | Full + custom |
| AI visibility checks | 3 queries     | 25 queries    | 100 queries   | 500 queries   |
| Historical data      | 30 days       | 90 days       | 1 year        | 2 years       |
| API access           | No            | No            | Yes           | Yes           |

### 21.2 Caching Strategy

| Layer        | What to Cache                  | TTL                   | Storage          |
| ------------ | ------------------------------ | --------------------- | ---------------- |
| Content Hash | LLM scores by SHA256(text)     | Until content changes | D1 + KV          |
| Lighthouse   | Full LH JSON per URL           | 7 days                | R2               |
| Visibility   | LLM responses (query+provider) | 24 hours              | KV               |
| robots.txt   | Parsed per domain              | 24 hours              | KV               |
| DNS          | Resolved IPs                   | 1 hour                | In-memory (Rust) |
| Page renders | Dashboard HTML/JSON            | 5 minutes             | CF Cache API     |

### 21.3 Infrastructure Costs

| Component          | Free Tier         | At 100 Users | At 1,000 Users |
| ------------------ | ----------------- | ------------ | -------------- |
| Cloudflare Workers | 100K req/day free | $5/mo        | $25/mo         |
| D1 Database        | 5M reads free     | $0           | $5/mo          |
| R2 Storage         | 10GB free         | $0.50/mo     | $15/mo         |
| KV Store           | 100K reads free   | $0.50/mo     | $5/mo          |
| Hetzner VPS (CX31) | N/A               | €8.50/mo     | €8.50/mo       |
| LLM API Costs      | N/A               | ~$50/mo      | ~$400/mo       |
| **Total**          | —                 | **~$65/mo**  | **~$460/mo**   |

---

## 22. Deployment & CI/CD

### 22.1 Cloudflare Deployment

```yaml
name: Deploy Cloudflare
on:
  push: { branches: [main] }
  paths: ["packages/**", "apps/web/**"]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx turbo build --filter=web --filter=api
      - run: npx wrangler deploy
        env: { CLOUDFLARE_API_TOKEN: "${{ secrets.CF_API_TOKEN }}" }
      - run: npx wrangler d1 migrations apply ai-seo-db --remote
```

### 22.2 Hetzner Crawler Deployment

```yaml
name: Deploy Crawler
on:
  push: { branches: [main] }
  paths: ["apps/crawler/**"]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          {
            registry: ghcr.io,
            username: "${{ github.actor }}",
            password: "${{ secrets.GITHUB_TOKEN }}",
          }
      - uses: docker/build-push-action@v5
        with:
          {
            context: .,
            file: apps/crawler/Dockerfile,
            push: true,
            tags: "ghcr.io/${{ github.repository }}/crawler:latest",
          }
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.HETZNER_HOST }}
          username: deploy
          key: ${{ secrets.HETZNER_SSH_KEY }}
          script: |
            cd /opt/crawler && docker compose pull && docker compose up -d --force-recreate && docker system prune -f
```

### 22.3 Environment Configuration

| Secret/Variable               | Where             | Purpose                        |
| ----------------------------- | ----------------- | ------------------------------ |
| CF_API_TOKEN                  | GitHub Secrets    | Wrangler deploy authentication |
| SHARED_SECRET                 | Both CF + Hetzner | HMAC signing                   |
| HETZNER_HOST                  | GitHub Secrets    | Crawler server IP              |
| HETZNER_SSH_KEY               | GitHub Secrets    | Deploy SSH key                 |
| R2_ACCESS_KEY / R2_SECRET_KEY | Hetzner env       | R2 upload credentials          |
| ANTHROPIC_API_KEY             | CF Workers env    | LLM content scoring            |
| OPENAI_API_KEY                | CF Workers env    | Visibility checks              |
| STRIPE_SECRET_KEY             | CF Workers env    | Billing                        |
| CLERK_SECRET_KEY              | CF Workers env    | Authentication                 |
| SENTRY_DSN                    | Both              | Error tracking                 |
| POSTHOG_API_KEY               | CF Workers env    | Product analytics              |

### 22.4 Monitoring & Alerts

| Alert                 | Condition                  | Channel        |
| --------------------- | -------------------------- | -------------- |
| Crawler down          | Health check fails > 2 min | Email + Slack  |
| Job failure rate      | > 5% in 1 hour             | Email          |
| Worker error rate     | > 1% 5xx in 15 min         | Email          |
| Crawler memory        | > 80% of 4GB               | Email          |
| D1 approaching limits | > 80% quota                | Email (weekly) |

---

## 23. Risk Assessment & Mitigation

### 23.1 Technical Risks

| Risk                                | Probability | Impact | Mitigation                                                                 |
| ----------------------------------- | ----------- | ------ | -------------------------------------------------------------------------- |
| D1 row/size limits at scale         | Medium      | High   | Monitor usage, prepare Turso/Planetscale migration, archive old data to R2 |
| LLM API rate limits and cost spikes | Medium      | High   | Per-user daily LLM budget caps, batch API calls, aggressive caching        |
| Hetzner single point of failure     | Medium      | High   | Dockerized for quick recovery, health checks, prepare standby VPS          |
| Crawler blocked by target sites     | Medium      | Medium | Respect robots.txt, reasonable rate limiting, retry with backoff           |
| Lighthouse timeouts on slow sites   | Medium      | Low    | 60s timeout per page, skip and score without perf data                     |

### 23.2 Business Risks

| Risk                                  | Probability | Impact   | Mitigation                                                  |
| ------------------------------------- | ----------- | -------- | ----------------------------------------------------------- |
| Semrush/Ahrefs launch competitive GEO | High        | Medium   | Focus on actionability differentiator, move fast            |
| Low free-to-paid conversion           | Medium      | High     | Ensure free tier value but clear limits, A/B test prompts   |
| High churn after first month          | Medium      | High     | Crawl comparison for progress = retention, scheduled crawls |
| Market not ready for GEO tools        | Low         | Critical | Validate with beta users in first 6 weeks, pivot path ready |
| Solo founder bottleneck               | Medium      | Medium   | AI tools aggressively, focus on highest-leverage work       |

### 23.3 Regulatory Risks

| Risk                         | Probability | Impact | Mitigation                                             |
| ---------------------------- | ----------- | ------ | ------------------------------------------------------ |
| GDPR compliance for EU users | High        | Medium | Data deletion, export, privacy policy, CF EU residency |
| LLM provider TOS changes     | Medium      | Medium | Abstract LLM layer for easy provider swapping          |
| Crawling legal concerns      | Low         | Medium | Respect robots.txt, honor rate limits                  |

---

## 24. Post-Launch Iteration Plan

### 24.1 Week 1-2 Post-Launch

- Monitor all KPIs daily (signups, activation, crawl volume, errors)
- Respond to support requests within 4 hours
- Fix critical bugs within 24 hours
- Collect qualitative feedback via in-app widget and direct outreach
- Watch for: where users get stuck, which features they ignore, what they ask for

### 24.2 Month 2

- Analyze activation funnel: where do users drop off?
- A/B test onboarding flow variations
- Implement top 3 user-requested features
- Optimize scoring engine based on feedback
- Begin content marketing: weekly blog posts

### 24.3 Month 3

- A/B test pricing page
- Implement scheduled crawls if not shipped
- Begin competitor visibility comparison
- Plan v2.0 roadmap based on data
- Evaluate: Chrome extension, WordPress plugin, or API — which has most demand?

### 24.4 Feedback Collection

| Method                        | Frequency          | Purpose                    |
| ----------------------------- | ------------------ | -------------------------- |
| In-app feedback widget        | Always on          | Friction points in context |
| NPS survey                    | Quarterly          | Overall satisfaction trend |
| User interviews (5-10)        | Monthly            | Deep qualitative insights  |
| Feature request board (Canny) | Always on          | Prioritize by demand       |
| Support ticket analysis       | Weekly             | Common confusion/bugs      |
| Analytics funnel analysis     | Weekly             | Drop-off points            |
| Churn survey                  | Every cancellation | Why users leave            |

---

## 25. Appendices

### Appendix A: Key Dependencies

**Rust Crates (Crawler)**

| Crate                          | Purpose                             |
| ------------------------------ | ----------------------------------- |
| axum                           | HTTP server framework               |
| tokio                          | Async runtime                       |
| reqwest                        | HTTP client with connection pooling |
| scraper / lol-html             | HTML parsing and element extraction |
| governor                       | Rate limiting (token bucket)        |
| tokio-util (CancellationToken) | Cooperative task cancellation       |
| serde / serde_json             | Serialization                       |
| aws-sdk-s3                     | R2 uploads (S3-compatible API)      |
| tracing                        | Structured logging                  |
| robotstxt                      | robots.txt parsing                  |

**TypeScript Packages (Cloudflare)**

| Package                     | Purpose                                       |
| --------------------------- | --------------------------------------------- |
| hono                        | Lightweight Workers-compatible HTTP framework |
| drizzle-orm + drizzle-kit   | Type-safe D1 ORM and migrations               |
| zod                         | Runtime schema validation for API contracts   |
| @clerk/nextjs or lucia-auth | Authentication                                |
| stripe                      | Billing and subscription management           |
| @anthropic-ai/sdk           | Content scoring LLM calls                     |
| openai                      | Visibility check LLM calls                    |
| posthog-js                  | Product analytics                             |
| @sentry/nextjs              | Error tracking                                |

### Appendix B: Issue Code Reference

| Code                     | Category     | Severity | Message                                    |
| ------------------------ | ------------ | -------- | ------------------------------------------ |
| `MISSING_TITLE`          | technical    | critical | Page is missing a title tag                |
| `MISSING_META_DESC`      | technical    | warning  | Page is missing a meta description         |
| `MISSING_H1`             | technical    | warning  | Page has no H1 heading                     |
| `MULTIPLE_H1`            | technical    | warning  | Page has multiple H1 headings              |
| `HEADING_HIERARCHY`      | technical    | info     | Heading levels are skipped                 |
| `BROKEN_LINKS`           | technical    | warning  | Page contains broken internal links        |
| `MISSING_CANONICAL`      | technical    | warning  | Page is missing a canonical URL tag        |
| `NOINDEX_SET`            | technical    | critical | Page is set to noindex                     |
| `MISSING_ALT_TEXT`       | technical    | warning  | Images are missing alt text                |
| `HTTP_STATUS`            | technical    | critical | Page returns 4xx or 5xx status             |
| `MISSING_OG_TAGS`        | technical    | info     | Open Graph tags are missing                |
| `SLOW_RESPONSE`          | technical    | warning  | Server response > 2 seconds                |
| `MISSING_SITEMAP`        | technical    | info     | No sitemap.xml found                       |
| `THIN_CONTENT`           | content      | warning  | Page has fewer than 500 words              |
| `CONTENT_DEPTH`          | content      | varies   | Content lacks comprehensive coverage       |
| `CONTENT_CLARITY`        | content      | varies   | Structure and readability need improvement |
| `CONTENT_AUTHORITY`      | content      | varies   | Content lacks expertise signals            |
| `DUPLICATE_CONTENT`      | content      | warning  | Content duplicated from another page       |
| `STALE_CONTENT`          | content      | info     | Content appears over 12 months old         |
| `NO_INTERNAL_LINKS`      | content      | warning  | Fewer than 2 internal links                |
| `EXCESSIVE_LINKS`        | content      | info     | External links outnumber internal 3:1      |
| `MISSING_FAQ_STRUCTURE`  | content      | info     | Q&A content not in FAQ format              |
| `MISSING_LLMS_TXT`       | ai_readiness | critical | No llms.txt file found                     |
| `AI_CRAWLER_BLOCKED`     | ai_readiness | critical | robots.txt blocks AI crawlers              |
| `NO_STRUCTURED_DATA`     | ai_readiness | warning  | No JSON-LD structured data found           |
| `INCOMPLETE_SCHEMA`      | ai_readiness | warning  | Schema missing required properties         |
| `CITATION_WORTHINESS`    | ai_readiness | varies   | Content unlikely to be cited by AI         |
| `NO_DIRECT_ANSWERS`      | ai_readiness | warning  | Content lacks direct answers               |
| `MISSING_ENTITY_MARKUP`  | ai_readiness | info     | Key entities not in schema                 |
| `NO_SUMMARY_SECTION`     | ai_readiness | info     | No summary or key takeaway section         |
| `POOR_QUESTION_COVERAGE` | ai_readiness | warning  | Doesn't address likely queries             |
| `INVALID_SCHEMA`         | ai_readiness | warning  | JSON-LD has parse errors                   |
| `LH_PERF_LOW`            | performance  | warning  | Lighthouse Performance below threshold     |
| `LH_SEO_LOW`             | performance  | warning  | Lighthouse SEO below 0.8                   |
| `LH_A11Y_LOW`            | performance  | info     | Lighthouse Accessibility below 0.7         |
| `LH_BP_LOW`              | performance  | info     | Lighthouse Best Practices below 0.8        |
| `LARGE_PAGE_SIZE`        | performance  | warning  | Page size exceeds 3MB                      |

### Appendix C: Glossary

| Term                  | Definition                                                                  |
| --------------------- | --------------------------------------------------------------------------- |
| **GEO**               | Generative Engine Optimization — optimizing content for AI search engines   |
| **AI Readiness**      | How well a page is structured for AI systems to parse, understand, and cite |
| **llms.txt**          | A proposed standard file providing metadata to LLM crawlers                 |
| **Visibility Check**  | Querying an LLM and checking if a domain is mentioned or cited              |
| **Citation Position** | Where in an LLM response a domain appears (1st, 2nd, 3rd, not cited)        |
| **Content Hash**      | SHA256 hash of extracted text, used to detect changes between crawls        |
| **Crawl Credits**     | Monthly allocation of crawl jobs per subscription tier                      |
| **Scoring Factor**    | One of 37 individual checks contributing to the AI-readiness score          |

---

_End of Document_
