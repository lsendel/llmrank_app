function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function createGeneratorService() {
  return {
    generateSitemap(pages: { url: string; lastmod?: string }[]) {
      const entries = pages
        .map(
          (p) =>
            `  <url>\n    <loc>${escapeXml(p.url)}</loc>\n    <lastmod>${p.lastmod ?? new Date().toISOString().split("T")[0]}</lastmod>\n  </url>`,
        )
        .join("\n");
      return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`;
    },

    generateLlmsTxt(data: {
      title: string;
      description: string;
      pages: { url: string; title: string; description?: string }[];
    }) {
      const entries = data.pages
        .map(
          (p) =>
            `- [${p.title}](${p.url})${p.description ? `: ${p.description}` : ""}`,
        )
        .join("\n");
      return `# ${data.title}\n\n> ${data.description}\n\n## Pages\n\n${entries}`;
    },
  };
}
