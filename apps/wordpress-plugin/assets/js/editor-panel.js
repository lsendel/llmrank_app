/* global llmBoostConfig, wp, window, fetch, setTimeout, clearTimeout */
(function () {
  var el = wp.element.createElement;
  var Fragment = wp.element.Fragment;
  var useState = wp.element.useState;
  var useEffect = wp.element.useEffect;
  var useRef = wp.element.useRef;
  var registerPlugin = wp.plugins.registerPlugin;
  var PluginSidebar = wp.editPost.PluginSidebar;
  var PluginSidebarMoreMenuItem = wp.editPost.PluginSidebarMoreMenuItem;
  var useSelect = wp.data.useSelect;
  var PanelBody = wp.components.PanelBody;
  var Spinner = wp.components.Spinner;

  var DEBOUNCE_MS = 5000;

  function scoreColor(score) {
    if (score >= 80) return "#16a34a";
    if (score >= 60) return "#2563eb";
    return "#dc2626";
  }

  function scoreClass(score) {
    if (score >= 80) return "llm-boost-panel__category-score--good";
    if (score >= 60) return "llm-boost-panel__category-score--ok";
    return "llm-boost-panel__category-score--bad";
  }

  function ScoreCircle(props) {
    var score = props.score || 0;
    var r = 42;
    var circumference = 2 * Math.PI * r;
    var offset = circumference - (score / 100) * circumference;

    return el(
      "div",
      { className: "llm-boost-panel__score-circle" },
      el(
        "div",
        { className: "llm-boost-panel__score-ring" },
        el(
          "svg",
          { width: 100, height: 100, viewBox: "0 0 100 100" },
          el("circle", { className: "bg", cx: 50, cy: 50, r: r }),
          el("circle", {
            className: "fg",
            cx: 50,
            cy: 50,
            r: r,
            stroke: scoreColor(score),
            strokeDasharray: circumference,
            strokeDashoffset: offset,
          }),
        ),
        el("span", { className: "llm-boost-panel__score-value" }, score),
      ),
      el(
        "span",
        { className: "llm-boost-panel__score-label" },
        "AI Readiness Score",
      ),
    );
  }

  /** Strip HTML tags using regex — safe since we only use the result as API input text */
  function stripHtml(html) {
    return html
      .replace(/<[^>]*>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function LLMBoostPanel() {
    var postData = useSelect(function (select) {
      var editor = select("core/editor");
      return {
        title: editor.getEditedPostAttribute("title") || "",
        content: editor.getEditedPostAttribute("content") || "",
        excerpt: editor.getEditedPostAttribute("excerpt") || "",
        slug: editor.getEditedPostAttribute("slug") || "",
      };
    });

    var _state = useState(null);
    var result = _state[0];
    var setResult = _state[1];

    var _loading = useState(false);
    var loading = _loading[0];
    var setLoading = _loading[1];

    var _error = useState(null);
    var error = _error[0];
    var setError = _error[1];

    var timerRef = useRef(null);

    useEffect(
      function () {
        if (!postData.title && !postData.content) return;

        if (timerRef.current) clearTimeout(timerRef.current);

        timerRef.current = setTimeout(function () {
          fetchScore(postData);
        }, DEBOUNCE_MS);

        return function () {
          if (timerRef.current) clearTimeout(timerRef.current);
        };
      },
      [postData.title, postData.content, postData.excerpt],
    );

    function fetchScore(data) {
      setLoading(true);
      setError(null);

      var url =
        (llmBoostConfig.apiUrl || "https://api.llmboost.com") + "/api/v1/score";

      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + llmBoostConfig.apiKey,
        },
        body: JSON.stringify({
          title: data.title,
          content: stripHtml(data.content),
          url: window.location.origin + "/" + data.slug,
          metaDescription: data.excerpt,
        }),
      })
        .then(function (res) {
          if (!res.ok) throw new Error("API returned " + res.status);
          return res.json();
        })
        .then(function (json) {
          setResult(json.data || json);
          setLoading(false);
        })
        .catch(function (err) {
          setError(err.message);
          setLoading(false);
        });
    }

    // Empty state
    if (!result && !loading && !error) {
      return el(
        "div",
        { className: "llm-boost-panel__empty" },
        el("p", null, "Start writing to see your AI readiness score."),
        el("p", null, "Scores update automatically as you edit."),
      );
    }

    return el(
      Fragment,
      null,
      loading &&
        el(
          "div",
          { className: "llm-boost-panel__loading" },
          el(Spinner, null),
          "Analyzing content...",
        ),

      error &&
        el(
          "div",
          {
            className:
              "llm-boost-panel__issue llm-boost-panel__issue--critical",
          },
          "Error: " + error,
        ),

      result &&
        el(
          "div",
          { className: "llm-boost-panel" },
          el(ScoreCircle, { score: result.overallScore }),

          el(
            PanelBody,
            { title: "Category Scores", initialOpen: true },
            el(
              "div",
              { className: "llm-boost-panel__categories" },
              [
                { key: "technical", label: "Technical SEO" },
                { key: "content", label: "Content Quality" },
                { key: "aiReadiness", label: "AI Readiness" },
                { key: "performance", label: "Performance" },
              ].map(function (cat) {
                var s = result.scores && result.scores[cat.key];
                return el(
                  "div",
                  { className: "llm-boost-panel__category", key: cat.key },
                  el("span", null, cat.label),
                  el(
                    "span",
                    {
                      className:
                        "llm-boost-panel__category-score " + scoreClass(s || 0),
                    },
                    (s || 0) + "/100",
                  ),
                );
              }),
            ),
          ),

          result.topIssues &&
            result.topIssues.length > 0 &&
            el(
              PanelBody,
              {
                title: "Top Issues (" + result.topIssues.length + ")",
                initialOpen: true,
              },
              el(
                "div",
                { className: "llm-boost-panel__issues" },
                result.topIssues.map(function (issue, i) {
                  var cls =
                    "llm-boost-panel__issue llm-boost-panel__issue--" +
                    (issue.severity || "info");
                  return el(
                    "div",
                    { className: cls, key: i },
                    issue.message || issue.code,
                  );
                }),
              ),
            ),
        ),
    );
  }

  registerPlugin("llm-boost", {
    render: function () {
      return el(
        Fragment,
        null,
        el(
          PluginSidebarMoreMenuItem,
          { target: "llm-boost-sidebar" },
          "LLM Rank",
        ),
        el(
          PluginSidebar,
          {
            name: "llm-boost-sidebar",
            title: "LLM Rank",
            icon: "chart-bar",
          },
          el(LLMBoostPanel, null),
        ),
      );
    },
  });
})();
