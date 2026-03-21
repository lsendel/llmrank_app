use std::collections::HashMap;
use thiserror::Error;
use url::Url;

#[derive(Error, Debug)]
pub enum RobotsError {
    #[error("Failed to fetch robots.txt: {0}")]
    FetchError(#[from] reqwest::Error),
    #[error("Invalid URL: {0}")]
    UrlError(String),
}

/// Known AI bot user agents to check in robots.txt.
pub const AI_BOT_USER_AGENTS: &[&str] = &["GPTBot", "ClaudeBot", "PerplexityBot", "GoogleOther"];

/// A single parsed robots.txt rule (allow or disallow).
#[derive(Debug, Clone)]
struct RobotsRule {
    path: String,
    allow: bool,
}

/// Parsed robots.txt rules for a single domain.
pub struct RobotsChecker {
    /// Map from lowercase user-agent to list of allow/disallow rules.
    rules: HashMap<String, Vec<RobotsRule>>,
    /// Sitemaps discovered in robots.txt
    pub sitemaps: Vec<String>,
    /// Whether we successfully fetched and parsed the robots.txt.
    pub loaded: bool,
}

impl RobotsChecker {
    /// Fetch and parse robots.txt for the given domain.
    pub async fn new(domain: &str) -> Result<Self, RobotsError> {
        let robots_url = format!("https://{}/robots.txt", domain);
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .user_agent("AISEOBot/1.0")
            .build()?;

        let response = match client.get(&robots_url).send().await {
            Ok(resp) if resp.status().is_success() => resp,
            Ok(_) => {
                // No robots.txt or error — everything is allowed
                return Ok(RobotsChecker {
                    rules: HashMap::new(),
                    sitemaps: Vec::new(),
                    loaded: false,
                });
            }
            Err(_) => {
                return Ok(RobotsChecker {
                    rules: HashMap::new(),
                    sitemaps: Vec::new(),
                    loaded: false,
                });
            }
        };

        let body = response.text().await.unwrap_or_default();
        let (rules, sitemaps) = Self::parse_robots_txt(&body);

        Ok(RobotsChecker {
            rules,
            sitemaps,
            loaded: true,
        })
    }

    /// Create a RobotsChecker from raw robots.txt content (useful for testing).
    pub fn from_content(content: &str) -> Self {
        let (rules, sitemaps) = Self::parse_robots_txt(content);
        RobotsChecker {
            rules,
            sitemaps,
            loaded: true,
        }
    }

    /// Check if the given URL is allowed for the specified user agent.
    /// Implements longest-match precedence per the robots.txt spec:
    /// the most specific (longest) matching rule wins regardless of allow/disallow order.
    pub fn is_allowed(&self, url: &str, user_agent: &str) -> bool {
        let path = match Url::parse(url) {
            Ok(u) => u.path().to_string(),
            Err(_) => return true,
        };

        let ua_lower = user_agent.to_lowercase();

        // Check specific user-agent rules first, then fall back to wildcard.
        // Stop at the first agent that has any matching rules.
        let agents_to_check = [ua_lower.as_str(), "*"];

        for agent in &agents_to_check {
            if let Some(rules) = self.rules.get(*agent) {
                // Find the longest matching rule path.
                let best: Option<&RobotsRule> = rules
                    .iter()
                    .filter(|r| {
                        // Empty Disallow means allow all — treat as a zero-length match
                        // only if there are no other rules; handled by returning true below.
                        if r.path.is_empty() {
                            return false;
                        }
                        path.starts_with(r.path.as_str())
                    })
                    .max_by_key(|r| r.path.len());

                if let Some(rule) = best {
                    return rule.allow;
                }

                // If this agent has rules but none matched, check for an empty Disallow
                // (which means "allow everything for this agent").
                // We only stop here if the agent actually had rules defined.
                if !rules.is_empty() {
                    // No rule matched — allowed by default for this agent block.
                    return true;
                }
            }
        }

        // No rules at all — default allow.
        true
    }

    /// Check which AI bots are blocked for a given URL.
    pub fn blocked_bots(&self, url: &str) -> Vec<String> {
        AI_BOT_USER_AGENTS
            .iter()
            .filter(|ua| !self.is_allowed(url, ua))
            .map(|ua| ua.to_string())
            .collect()
    }

    /// Parse robots.txt content into a map of user-agent -> rules (allow/disallow), and list of sitemaps.
    fn parse_robots_txt(content: &str) -> (HashMap<String, Vec<RobotsRule>>, Vec<String>) {
        let mut rules: HashMap<String, Vec<RobotsRule>> = HashMap::new();
        let mut sitemaps: Vec<String> = Vec::new();
        let mut current_agents: Vec<String> = Vec::new();

        for line in content.lines() {
            let line = line.trim();

            // Strip inline comments
            let line = if let Some(idx) = line.find('#') {
                line[..idx].trim()
            } else {
                line
            };

            if line.is_empty() {
                // Empty line resets current user-agent context
                current_agents.clear();
                continue;
            }

            if let Some((key, value)) = line.split_once(':') {
                let key = key.trim().to_lowercase();
                let value = value.trim();

                match key.as_str() {
                    "user-agent" => {
                        let ua = value.to_lowercase();
                        current_agents.push(ua);
                    }
                    "allow" => {
                        for agent in &current_agents {
                            rules.entry(agent.clone()).or_default().push(RobotsRule {
                                path: value.to_string(),
                                allow: true,
                            });
                        }
                    }
                    "disallow" => {
                        for agent in &current_agents {
                            rules.entry(agent.clone()).or_default().push(RobotsRule {
                                path: value.to_string(),
                                allow: false,
                            });
                        }
                    }
                    "sitemap" => {
                        if !value.is_empty() {
                            sitemaps.push(value.to_string());
                        }
                    }
                    _ => {
                        // Crawl-delay, etc. — ignored
                    }
                }
            }
        }

        (rules, sitemaps)
    }
}

/// Fetch /llms.txt from a domain. Returns the content if found (HTTP 200).
pub async fn fetch_llms_txt(domain: &str) -> Option<String> {
    let url = format!("https://{}/llms.txt", domain);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("AISEOBot/1.0")
        .build()
        .ok()?;

    let response = client.get(&url).send().await.ok()?;
    if response.status().is_success() {
        response.text().await.ok()
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_ROBOTS: &str = r#"
User-agent: *
Disallow: /admin/
Disallow: /private/

User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: GoogleOther
Disallow: /search
"#;

    #[test]
    fn test_parse_wildcard_rules() {
        let checker = RobotsChecker::from_content(SAMPLE_ROBOTS);
        assert!(checker.loaded);

        // Wildcard blocks /admin/ and /private/
        assert!(!checker.is_allowed("https://example.com/admin/page", "*"));
        assert!(!checker.is_allowed("https://example.com/private/data", "*"));
        assert!(checker.is_allowed("https://example.com/public", "*"));
    }

    #[test]
    fn test_gptbot_blocked() {
        let checker = RobotsChecker::from_content(SAMPLE_ROBOTS);
        // GPTBot is disallowed for everything
        assert!(!checker.is_allowed("https://example.com/", "GPTBot"));
        assert!(!checker.is_allowed("https://example.com/any/page", "GPTBot"));
    }

    #[test]
    fn test_claudebot_blocked() {
        let checker = RobotsChecker::from_content(SAMPLE_ROBOTS);
        assert!(!checker.is_allowed("https://example.com/", "ClaudeBot"));
    }

    #[test]
    fn test_googleother_partial_block() {
        let checker = RobotsChecker::from_content(SAMPLE_ROBOTS);
        // GoogleOther has a specific block for /search
        assert!(!checker.is_allowed("https://example.com/search?q=test", "GoogleOther"));
        // Per spec: a specific user-agent block takes full precedence over wildcard.
        // GoogleOther's block only covers /search, so /admin/ and /blog are both allowed.
        assert!(checker.is_allowed("https://example.com/admin/", "GoogleOther"));
        assert!(checker.is_allowed("https://example.com/blog", "GoogleOther"));
    }

    #[test]
    fn test_unknown_bot_uses_wildcard() {
        let checker = RobotsChecker::from_content(SAMPLE_ROBOTS);
        assert!(!checker.is_allowed("https://example.com/admin/", "SomeOtherBot"));
        assert!(checker.is_allowed("https://example.com/public", "SomeOtherBot"));
    }

    #[test]
    fn test_blocked_bots() {
        let checker = RobotsChecker::from_content(SAMPLE_ROBOTS);
        let blocked = checker.blocked_bots("https://example.com/page");
        assert!(blocked.contains(&"GPTBot".to_string()));
        assert!(blocked.contains(&"ClaudeBot".to_string()));
        // GoogleOther is not blocked for /page (only /search)
        assert!(!blocked.contains(&"GoogleOther".to_string()));
    }

    #[test]
    fn test_empty_robots() {
        let checker = RobotsChecker::from_content("");
        assert!(checker.is_allowed("https://example.com/anything", "GPTBot"));
    }

    #[test]
    fn test_allow_all_robots() {
        let content = "User-agent: *\nDisallow:\n";
        let checker = RobotsChecker::from_content(content);
        assert!(checker.is_allowed("https://example.com/anything", "GPTBot"));
    }

    #[test]
    fn test_allow_overrides_disallow() {
        let content = "User-agent: *\nDisallow: /private/\nAllow: /private/public\n";
        let checker = RobotsChecker::from_content(content);
        assert!(!checker.is_allowed("https://example.com/private/secret", "*"));
        assert!(checker.is_allowed("https://example.com/private/public/page", "*"));
    }
}
